/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@/types/user';
import { UserRole as SharedUserRole } from '@transit-logistic/shared';
import * as bcrypt from 'bcrypt';

import { addDurationToNow, generateRefreshToken, hashToken } from '../../common/utils/token.util';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    role: string;
    locale: string;
    phone: string | null;
    isVerified: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly notificationDelivery: NotificationDeliveryService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensResponse> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email.toLowerCase() },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message_en: 'A user with this email or phone already exists.',
        message_ar: 'يوجد مستخدم بهذا البريد الإلكتروني أو رقم الهاتف بالفعل.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        locale: dto.locale ?? 'en',
        ...(dto.role === SharedUserRole.CUSTOMER && dto.fullName
          ? {
              customerProfile: {
                create: {
                  fullName: dto.fullName,
                },
              },
            }
          : {}),
        ...(dto.role === SharedUserRole.FLEET_OWNER
          ? {
              fleetOwner: {
                create: {
                  companyName: dto.email.split('@')[0] ?? 'Fleet Owner',
                },
              },
            }
          : {}),
      },
    });

    await this.cleanupExpiredRefreshTokens();

    if (dto.role === SharedUserRole.CUSTOMER) {
      void this.notificationDelivery.safeNotifyRegistrationSuccess({
        userId: user.id,
        email: user.email,
        name: dto.fullName ?? user.email.split('@')[0] ?? 'Customer',
        locale: (user.locale as 'en' | 'ar') ?? 'en',
      });
    }

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message_en: 'Invalid email or password.',
        message_ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message_en: 'Account temporarily locked due to failed login attempts. Try again later.',
        message_ar: 'تم قفل الحساب مؤقتاً بسبب محاولات تسجيل دخول فاشلة. حاول لاحقاً.',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_SUSPENDED',
        message_en: 'Your account has been suspended.',
        message_ar: 'تم تعليق حسابك.',
      });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        failedLoginAttempts >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOCK_DURATION_MS)
          : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts,
          lockedUntil,
        },
      });

      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message_en: 'Invalid email or password.',
        message_ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.cleanupExpiredRefreshTokens();

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!stored || !stored.user.isActive) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message_en: 'Invalid or expired refresh token.',
        message_ar: 'رمز التحديث غير صالح أو منتهي الصلاحية.',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    await this.cleanupExpiredRefreshTokens();

    return this.issueTokens(stored.user);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const tokenHash = hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.cleanupExpiredRefreshTokens();

    return { success: true };
  }

  async logoutAll(userId: string): Promise<{ success: true; revokedCount: number }> {
    await this.cleanupExpiredRefreshTokens();

    const result = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { success: true, revokedCount: result.count };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      return { success: true };
    }

    const rawToken = generateRefreshToken();
    const tokenHash = hashToken(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const webUrl = this.config.get<string>('app.webUrl', 'http://127.0.0.1:3000');
    const resetUrl = `${webUrl}/en/reset-password?token=${rawToken}`;

    void this.notificationDelivery.safeNotifyPasswordReset({
      userId: user.id,
      email: user.email,
      resetUrl,
      locale: (user.locale as 'en' | 'ar') ?? 'en',
    });

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const tokenHash = hashToken(dto.token);

    const stored = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!stored || !stored.user.isActive) {
      throw new UnauthorizedException({
        code: 'INVALID_RESET_TOKEN',
        message_en: 'Invalid or expired password reset token.',
        message_ar: 'رمز إعادة تعيين كلمة المرور غير صالح أو منتهي.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  private async cleanupExpiredRefreshTokens() {
    await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  private async issueTokens(user: User): Promise<AuthTokensResponse> {
    const accessExpiresIn = this.config.get<string>('jwt.accessExpiresIn', '15m');
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn', '7d');

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: addDurationToNow(refreshExpiresIn),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        locale: user.locale,
        phone: user.phone,
        isVerified: user.isVerified,
      },
    };
  }
}
