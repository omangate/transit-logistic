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

const BCRYPT_ROUNDS = 12;

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

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_SUSPENDED',
        message_en: 'Your account has been suspended.',
        message_ar: 'تم تعليق حسابك.',
      });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message_en: 'Invalid email or password.',
        message_ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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
