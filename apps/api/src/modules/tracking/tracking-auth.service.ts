/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { Socket } from 'socket.io';

import { PrismaService } from '../../database/prisma.service';
import type { JwtPayload } from '../auth/jwt.strategy';

@Injectable()
export class TrackingAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async authenticateSocket(client: Socket): Promise<User> {
    const token = this.extractToken(client);

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message_en: 'Missing access token.',
        message_ar: 'رمز الوصول مفقود.',
      });
    }

    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message_en: 'JWT is not configured.',
        message_ar: 'لم يتم تكوين JWT.',
      });
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message_en: 'Invalid or expired access token.',
        message_ar: 'رمز الوصول غير صالح أو منتهي الصلاحية.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message_en: 'Invalid or expired access token.',
        message_ar: 'رمز الوصول غير صالح أو منتهي الصلاحية.',
      });
    }

    return user;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      return authorization.slice(7);
    }

    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }

    return null;
  }
}
