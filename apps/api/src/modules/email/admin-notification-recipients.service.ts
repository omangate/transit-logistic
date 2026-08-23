import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AdminNotificationRecipientsService.name);

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

  includesDemoAdmins(): boolean {
    return this.config.get<boolean>('email.adminNotificationIncludeDemoAdmins', false);
  }

  async list(): Promise<AdminNotificationRecipient[]> {
    const configuredEmail = this.getConfiguredEmail();
    const recipients = new Map<string, AdminNotificationRecipient>();

    if (configuredEmail) {
      recipients.set(configuredEmail, await this.resolveRecipient(configuredEmail));
    }

    if (this.includesDemoAdmins()) {
      const admins = await this.prisma.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { id: true, email: true, locale: true },
      });

      for (const admin of admins) {
        const key = admin.email.toLowerCase();
        if (!recipients.has(key)) {
          recipients.set(key, {
            email: admin.email,
            userId: admin.id,
            locale: admin.locale === 'en' ? 'en' : 'ar',
          });
        }
      }
    } else if (!configuredEmail) {
      const admins = await this.prisma.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { id: true, email: true, locale: true },
      });

      for (const admin of admins) {
        recipients.set(admin.email.toLowerCase(), {
          email: admin.email,
          userId: admin.id,
          locale: admin.locale === 'en' ? 'en' : 'ar',
        });
      }
    }

    if (recipients.size === 0) {
      this.logger.warn('No operational admin notification recipients configured');
    }

    return [...recipients.values()];
  }

  private async resolveRecipient(email: string): Promise<AdminNotificationRecipient> {
    const linkedUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, locale: true },
    });

    return {
      email: linkedUser?.email ?? email,
      userId: linkedUser?.id,
      locale: linkedUser?.locale === 'en' ? 'en' : 'ar',
    };
  }
}
