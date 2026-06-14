import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { hashToken } from '../../common/utils/token.util';
import type { PrismaService } from '../../database/prisma.service';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const jwtService = {
    sign: jest.fn().mockReturnValue('access-token'),
  };

  const config = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
      };
      return values[key] ?? defaultValue;
    }),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      { safeNotifyRegistrationSuccess: jest.fn() } as never,
    );
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('rejects login for unknown users', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'Password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes a refresh token on logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.logout('raw-refresh-token');

    expect(result).toEqual({ success: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken('raw-refresh-token'),
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
  });

  it('revokes all active refresh tokens on logoutAll', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.logoutAll('user-1');

    expect(result).toEqual({ success: true, revokedCount: 3 });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('issues tokens for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('Password1', 12);

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash,
      role: 'customer',
      locale: 'en',
      phone: null,
      isActive: true,
      isVerified: false,
    });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login({ email: 'user@example.com', password: 'Password1' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user.id).toBe('user-1');
  });
});
