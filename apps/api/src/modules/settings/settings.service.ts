/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export const DEFAULT_SETTINGS = {
  company: {
    nameEn: 'Transit Logistic',
    nameAr: 'ترانزيت لوجستك',
    email: 'support@transit-logistic.dev',
    phone: '+968 9000 0000',
    address: 'Muscat, Oman',
  },
  branding: {
    primaryColor: '#1D4ED8',
    accentColor: '#FDE68A',
    logoUrl: '/logo.svg',
  },
  email: {
    provider: 'resend',
    fromAddress: 'Transit Logistic <noreply@transit-logistic.dev>',
    enabled: false,
  },
  payment: {
    provider: 'thawani',
    currency: 'OMR',
    successPath: '/shipments/{id}/payment/success',
    cancelPath: '/shipments/{id}/payment/cancel',
  },
  notifications: {
    inApp: true,
    email: true,
    push: false,
  },
} as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    const rows = await this.prisma.platformSetting.findMany();
    const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;

    for (const row of rows) {
      merged[row.key] = row.value;
    }

    return merged;
  }

  async getSection<T extends keyof typeof DEFAULT_SETTINGS>(key: T): Promise<(typeof DEFAULT_SETTINGS)[T]> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return (row?.value as (typeof DEFAULT_SETTINGS)[T]) ?? DEFAULT_SETTINGS[key];
  }

  async updateSection(key: string, value: Record<string, unknown>) {
    const jsonValue = value as Prisma.InputJsonValue;

    return this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: jsonValue },
      update: { value: jsonValue },
    });
  }
}
