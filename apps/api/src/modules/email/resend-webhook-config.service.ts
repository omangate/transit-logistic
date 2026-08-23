import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

const PLATFORM_SETTING_KEY = 'email_resend_webhook';
const WEBHOOK_EVENTS = ['email.delivered', 'email.bounced', 'email.complained', 'email.failed', 'email.delivery_failed'];

type StoredWebhookConfig = {
  webhookId?: string;
  signingSecret?: string;
  endpoint?: string;
};

@Injectable()
export class ResendWebhookConfigService {
  private readonly logger = new Logger(ResendWebhookConfigService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getSigningSecret(): Promise<string | undefined> {
    const fromEnv = this.config.get<string>('email.resendWebhookSecret')?.trim();
    if (fromEnv) return fromEnv;

    const stored = await this.getStoredConfig();
    return stored.signingSecret;
  }

  isConfiguredSync(): boolean {
    return Boolean(this.config.get<string>('email.resendWebhookSecret')?.trim());
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(await this.getSigningSecret());
  }

  async ensureConfigured(): Promise<{ configured: boolean; webhookId?: string; created?: boolean; reason?: string }> {
    try {
      if (await this.isConfigured()) {
        const stored = await this.getStoredConfig();
        return { configured: true, webhookId: stored.webhookId };
      }

      const apiKey = this.config.get<string>('email.resendApiKey')?.trim();
      if (!apiKey) {
        return { configured: false, reason: 'missing_resend_api_key' };
      }

      const endpoint = this.resolveWebhookEndpoint();
      const listPayload = await this.resendRequest<{ data?: unknown }>(apiKey, 'GET', '/webhooks');
      const webhooks = Array.isArray(listPayload.data) ? listPayload.data : [];

      const existing = webhooks.find(
        (webhook): webhook is { id: string; endpoint: string; signing_secret?: string } =>
          typeof webhook === 'object' &&
          webhook !== null &&
          'endpoint' in webhook &&
          (webhook as { endpoint?: string }).endpoint === endpoint,
      );

      let signingSecret = existing?.signing_secret;
      let webhookId = existing?.id;
      let created = false;

      if (existing?.id && !signingSecret) {
        const retrieved = await this.resendRequest<{ signing_secret?: string }>(apiKey, 'GET', `/webhooks/${existing.id}`);
        signingSecret = retrieved.signing_secret;
        webhookId = existing.id;
      }

      if (!signingSecret) {
        const createdWebhook = await this.resendRequest<{ id?: string; signing_secret?: string }>(
          apiKey,
          'POST',
          '/webhooks',
          {
            endpoint,
            events: WEBHOOK_EVENTS,
          },
        );
        signingSecret = createdWebhook.signing_secret;
        webhookId = createdWebhook.id;
        created = true;
      }

      if (!signingSecret) {
        return { configured: false, reason: 'signing_secret_unavailable' };
      }

      await this.prisma.platformSetting.upsert({
        where: { key: PLATFORM_SETTING_KEY },
        create: {
          key: PLATFORM_SETTING_KEY,
          value: {
            webhookId,
            signingSecret,
            endpoint,
          } satisfies StoredWebhookConfig as Prisma.InputJsonValue,
        },
        update: {
          value: {
            webhookId,
            signingSecret,
            endpoint,
          } satisfies StoredWebhookConfig as Prisma.InputJsonValue,
        },
      });

      this.logger.log(`Resend webhook configured for ${endpoint}`);
      return { configured: true, webhookId, created };
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 200) : 'webhook_setup_failed';
      this.logger.warn(`Resend webhook setup failed: ${reason}`);
      return { configured: false, reason };
    }
  }

  private resolveWebhookEndpoint(): string {
    const webUrl = this.config.get<string>('app.webUrl', 'http://127.0.0.1:3000').replace(/\/$/, '');
    return `${webUrl}/api/v1/webhooks/resend`;
  }

  private async getStoredConfig(): Promise<StoredWebhookConfig> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: PLATFORM_SETTING_KEY } });
    return (row?.value as StoredWebhookConfig | null) ?? {};
  }

  private async resendRequest<T>(apiKey: string, method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`https://api.resend.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const payload = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? payload.error ?? `Resend API ${response.status}`);
    }

    return payload;
  }
}
