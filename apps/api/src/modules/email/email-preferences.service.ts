import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

import {
  CRITICAL_EMAIL_EVENTS,
  DEFAULT_EMAIL_PREFERENCES,
  OPTIONAL_EMAIL_PREFERENCE_MAP,
  type EmailLocale,
  type EmailPreferences,
} from './transactional-email.types';

@Injectable()
export class EmailPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  merge(preferences: EmailPreferences | null | undefined): Required<EmailPreferences> {
    return { ...DEFAULT_EMAIL_PREFERENCES, ...(preferences ?? {}) };
  }

  async getForUser(userId: string): Promise<Required<EmailPreferences>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailPreferences: true },
    });
    return this.merge(user?.emailPreferences as EmailPreferences | null);
  }

  async updateForUser(userId: string, patch: EmailPreferences): Promise<Required<EmailPreferences>> {
    const current = await this.getForUser(userId);
    const merged = { ...current, ...patch };
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailPreferences: merged },
    });
    return merged;
  }

  resolveLocale(locale?: string | null): EmailLocale {
    return locale === 'en' ? 'en' : 'ar';
  }

  shouldSend(event: string, preferences: EmailPreferences, globalEmailEnabled: boolean, force?: boolean): boolean {
    if (force || CRITICAL_EMAIL_EVENTS.has(event)) {
      return true;
    }

    if (!globalEmailEnabled) {
      return false;
    }

    const prefKey = OPTIONAL_EMAIL_PREFERENCE_MAP[event];
    if (!prefKey) {
      return true;
    }

    const merged = this.merge(preferences);
    return merged[prefKey] !== false;
  }

  isCritical(event: string): boolean {
    return CRITICAL_EMAIL_EVENTS.has(event);
  }
}
