import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../database/prisma.service';

import type { EmailLocale } from './transactional-email.types';

export type AdminNotificationRecipient = {
  email: string;
  userId?: string;
  locale: EmailLocale;
};

@Injectable()
export class AdminNotificationRecipientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getConfiguredEmail());
  }

  getConfiguredEmail(): string | undefined {
    return this.config.get<string>('email.adminNotificationEmail');
  }

  async list(): Promise<AdminNotificationRecipient[]> {
    const configuredEmail = this.getConfiguredEmail();
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true, email: true, locale: true },
    });

    const recipients = new Map<string, AdminNotificationRecipient>();

    for (const admin of admins) {
      recipients.set(admin.email.toLowerCase(), {
        email: admin.email,
        userId: admin.id,
        locale: admin.locale === 'en' ? 'en' : 'ar',
      });
    }

    if (configuredEmail) {
      if (!recipients.has(configuredEmail)) {
        const linkedUser = await this.prisma.user.findUnique({
          where: { email: configuredEmail },
          select: { id: true, email: true, locale: true },
        });

        recipients.set(configuredEmail, {
          email: linkedUser?.email ?? configuredEmail,
          userId: linkedUser?.id,
          locale: linkedUser?.locale === 'en' ? 'en' : 'ar',
        });
      }
    }

    return [...recipients.values()];
  }
}
