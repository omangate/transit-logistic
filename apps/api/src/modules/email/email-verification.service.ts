import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { generateRefreshToken, hashToken } from '../../common/utils/token.util';
import { PrismaService } from '../../database/prisma.service';

import { emailVerificationEmail, resolveWebAppUrl } from './email-templates';
import { TransactionalEmailService } from './transactional-email.service';
import type { EmailLocale } from './transactional-email.types';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly transactionalEmail: TransactionalEmailService,
  ) {}

  async sendVerificationEmail(userId: string, locale: EmailLocale = 'ar') {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, isVerified: true, customerProfile: { select: { fullName: true } } },
    });

    if (user.isVerified) {
      return { sent: false, alreadyVerified: true };
    }

    const rawToken = generateRefreshToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });

    const verifyUrl = resolveWebAppUrl(`/${locale}/verify-email?token=${rawToken}`);
    const html = emailVerificationEmail({
      locale,
      verifyUrl,
      name: user.customerProfile?.fullName,
    });

    return this.transactionalEmail.sendTransactional({
      userId: user.id,
      to: user.email,
      locale,
      event: 'auth.email_verification',
      eventKey: `verify:${user.id}:${Date.now()}`,
      subject: locale === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Verify your email',
      html,
      force: true,
    });
  }

  async verifyEmail(token: string) {
    const tokenHash = hashToken(token);
    const stored = await this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_VERIFICATION_TOKEN',
        message_en: 'Invalid or expired verification token.',
        message_ar: 'رمز التحقق غير صالح أو منتهي.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { isVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true, email: stored.user.email };
  }

  async requestEmailChange(userId: string, newEmail: string, locale: EmailLocale = 'ar') {
    const normalized = newEmail.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email: normalized, NOT: { id: userId } },
    });
    if (existing) {
      throw new UnauthorizedException({
        code: 'EMAIL_IN_USE',
        message_en: 'Email is already in use.',
        message_ar: 'البريد الإلكتروني مستخدم بالفعل.',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { email: normalized, isVerified: false },
    });

    return this.sendVerificationEmail(userId, locale);
  }
}
