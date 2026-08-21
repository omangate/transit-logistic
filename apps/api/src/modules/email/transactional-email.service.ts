/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { SettingsService } from '../settings/settings.service';

import { EmailDeliveryLogService } from './email-delivery-log.service';
import { EmailPreferencesService } from './email-preferences.service';
import { milestoneEmail, resolveWebAppUrl } from './email-templates';
import { buildMilestoneCopy, resolveWorkflowEvent } from './transactional-email.events';
import type {
  EmailLocale,
  MilestoneEmailContext,
  SendMilestoneEmailInput,
  SendTransactionalEmailInput,
} from './transactional-email.types';

import type Redis from 'ioredis';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];
const MESSAGE_THROTTLE_SECONDS = 300;

@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly replyTo?: string;
  private readonly provider: string;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly deliveryLog: EmailDeliveryLogService,
    private readonly preferences: EmailPreferencesService,
    private readonly settings: SettingsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const apiKey = this.config.get<string>('email.resendApiKey');
    this.provider = this.config.get<string>('email.provider', 'resend');
    this.fromEmail = this.config.get<string>('email.from', 'Transit Logistic <noreply@transit-logistic.dev>');
    this.replyTo = this.config.get<string>('email.replyTo');
    this.enabled = this.provider === 'resend' && Boolean(apiKey);
    this.resend = apiKey ? new Resend(apiKey) : null;

    if (!this.enabled) {
      this.logger.warn('Transactional email provider not configured — emails will be logged as skipped');
    }
  }

  isConfigured(): boolean {
    return this.enabled;
  }

  getProviderStatus() {
    const missingCredentials: string[] = [];
    const apiKey = this.config.get<string>('email.resendApiKey');
    const from = this.config.get<string>('email.from');
    const webUrl = this.config.get<string>('app.webUrl');

    if (this.provider === 'resend' && !apiKey) {
      missingCredentials.push('RESEND_API_KEY');
    }
    if (!from?.trim()) {
      missingCredentials.push('EMAIL_FROM');
    }
    if (!webUrl?.trim() || webUrl.includes('127.0.0.1')) {
      missingCredentials.push('WEB_APP_URL');
    }

    return {
      provider: this.provider,
      configured: this.enabled,
      from: this.fromEmail.replace(/<.*>/, '').trim() || this.fromEmail,
      replyTo: this.replyTo ?? null,
      webhookConfigured: Boolean(this.config.get<string>('email.resendWebhookSecret')),
      adminNotificationEmailConfigured: Boolean(this.config.get<string>('email.adminNotificationEmail')),
      missingCredentials,
    };
  }

  async sendAdminStagingTest(): Promise<{
    sent: boolean;
    skipped?: boolean;
    reason?: string;
    logId?: string;
  }> {
    const to = this.config.get<string>('email.adminNotificationEmail');
    if (!to?.trim()) {
      return { sent: false, skipped: true, reason: 'admin_notification_email_not_configured' };
    }

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
        <h2 style="margin:0 0 12px;">Transit Logistic — Staging Email Test</h2>
        <p style="margin:0 0 12px;">Staging admin notification email is configured and working successfully.</p>
        <p style="margin:0 0 12px;">تم اختبار نظام إشعارات Staging بنجاح.</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Sent at ${new Date().toISOString()}</p>
      </div>
    `;

    return this.sendTransactional({
      to,
      locale: 'en',
      event: 'admin.operational_alert',
      eventKey: `admin:staging-email-test:${Date.now()}`,
      subject: 'Transit Logistic - Email Test',
      html,
      force: true,
    });
  }

  async sendTransactional(input: SendTransactionalEmailInput): Promise<{ sent: boolean; skipped?: boolean; logId?: string }> {
    const locale = this.preferences.resolveLocale(input.locale);
    const notificationSettings = await this.settings.getSection('notifications');
    const userPrefs = input.userId ? await this.preferences.getForUser(input.userId) : {};

    if (
      !this.preferences.shouldSend(input.event, userPrefs, notificationSettings.email, input.force)
    ) {
      this.logger.debug(`Email suppressed by preferences: ${input.event} -> ${input.to}`);
      return { sent: false, skipped: true };
    }

    const claim = await this.deliveryLog.tryClaim({
      userId: input.userId,
      recipientEmail: input.to,
      eventKey: input.eventKey,
      templateEvent: input.event,
      entityType: input.entityType,
      entityId: input.entityId,
      locale,
      subject: input.subject,
      provider: this.provider,
      metadata: input.metadata,
    });

    if (!claim.claimed) {
      return { sent: false, skipped: true };
    }

    void this.dispatchWithRetry(claim.id, input.to, input.subject, input.html);
    return { sent: true, logId: claim.id };
  }

  async sendMilestone(input: SendMilestoneEmailInput) {
    const locale = this.preferences.resolveLocale(input.locale);
    const def = input.title
      ? {
          event: input.event,
          title: input.title,
          heading: input.heading ?? input.title,
          explanation: { en: input.context.explanation ?? '', ar: input.context.explanation ?? '' },
          nextAction: { en: input.context.nextAction ?? '', ar: input.context.nextAction ?? '' },
          statusBadge: { en: input.context.statusBadge ?? '', ar: input.context.statusBadge ?? '' },
          service: { en: input.context.service ?? '', ar: input.context.service ?? '' },
        }
      : null;

    const workflowDef =
      def ??
      (() => {
        const [domain] = input.event.split('.');
        const status = input.event.split('.').slice(1).join('.');
        if (domain === 'customs' || domain === 'freight') {
          return resolveWorkflowEvent(domain, status.replace(/^quote_/, 'quotation_').replace('clearance_started', 'clearance_in_progress'));
        }
        return null;
      })();

    const copy = workflowDef
      ? buildMilestoneCopy(workflowDef, locale, input.context)
      : {
          subject: `${input.context.orderReference ?? input.event}`,
          title: input.context.orderReference ?? input.event,
          heading: input.context.status ?? input.event,
          explanation: input.context.explanation ?? '',
          nextAction: input.context.nextAction ?? '',
          statusBadge: input.context.statusBadge ?? input.context.status ?? '',
          service: input.context.service ?? '',
        };

    const html = milestoneEmail({
      locale,
      title: copy.title,
      heading: copy.heading,
      explanation: copy.explanation,
      nextAction: copy.nextAction,
      statusBadge: copy.statusBadge,
      orderReference: input.context.orderReference,
      customerReference: input.context.customerReference,
      service: copy.service || input.context.service,
      status: input.context.status,
      occurredAt: input.context.occurredAt ?? new Date(),
      details: input.context.details,
      actionUrl: input.actionUrl,
      actionLabel: input.actionLabel?.[locale === 'ar' ? 'ar' : 'en'],
    });

    return this.sendTransactional({
      userId: input.userId,
      to: await this.resolveRecipientEmail(input.userId),
      locale,
      event: input.event,
      eventKey: input.eventKey,
      entityType: input.entityType,
      entityId: input.entityId,
      subject: copy.subject,
      html,
      force: input.force,
    });
  }

  async sendWorkflowStatusEmail(input: {
    userId: string;
    domain: 'customs' | 'freight';
    status: string;
    entityType: string;
    entityId: string;
    eventKey: string;
    context: MilestoneEmailContext;
    locale?: EmailLocale;
    path: string;
    force?: boolean;
  }) {
    const def = resolveWorkflowEvent(input.domain, input.status);
    if (!def) {
      this.logger.debug(`No email template for ${input.domain}:${input.status}`);
      return { sent: false, skipped: true };
    }

    const locale = this.preferences.resolveLocale(input.locale);
    const copy = buildMilestoneCopy(def, locale, input.context);
    const html = milestoneEmail({
      locale,
      title: copy.title,
      heading: copy.heading,
      explanation: copy.explanation,
      nextAction: copy.nextAction,
      statusBadge: copy.statusBadge,
      orderReference: input.context.orderReference,
      customerReference: input.context.customerReference,
      service: copy.service,
      status: input.context.status ?? copy.statusBadge,
      occurredAt: input.context.occurredAt ?? new Date(),
      details: input.context.details,
      actionUrl: resolveWebAppUrl(input.path),
      actionLabel: locale === 'ar' ? 'عرض المعاملة' : 'View Transaction',
    });

    return this.sendTransactional({
      userId: input.userId,
      to: await this.resolveRecipientEmail(input.userId),
      locale,
      event: def.event,
      eventKey: input.eventKey,
      entityType: input.entityType,
      entityId: input.entityId,
      subject: copy.subject,
      html,
      force: input.force ?? def.critical,
    });
  }

  async sendMessageEmailThrottled(input: {
    userId: string;
    conversationKey: string;
    orderReference: string;
    conversationUrl: string;
    locale?: EmailLocale;
    eventKey: string;
  }) {
    const throttleKey = `email:msg:${input.conversationKey}:${input.userId}`;
    const exists = await this.redis.get(throttleKey);
    if (exists) {
      return { sent: false, skipped: true, reason: 'throttled' as const };
    }

    const locale = this.preferences.resolveLocale(input.locale);
    const { messageNotificationEmail } = await import('./email-templates');
    const html = messageNotificationEmail({
      locale,
      orderReference: input.orderReference,
      conversationUrl: input.conversationUrl,
    });

    const result = await this.sendTransactional({
      userId: input.userId,
      to: await this.resolveRecipientEmail(input.userId),
      locale,
      event: 'message.new',
      eventKey: input.eventKey,
      entityType: 'conversation',
      entityId: input.conversationKey,
      subject:
        locale === 'ar'
          ? `رسالة جديدة — ${input.orderReference}`
          : `New message — ${input.orderReference}`,
      html,
    });

    if (result.sent) {
      await this.redis.set(throttleKey, '1', 'EX', MESSAGE_THROTTLE_SECONDS);
    }

    return result;
  }

  private async resolveRecipientEmail(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) {
      throw new Error(`User email not found: ${userId}`);
    }
    return user.email;
  }

  private dispatchWithRetry(logId: string, to: string, subject: string, html: string, attempt = 0) {
    void this.sendOnce(logId, to, subject, html, attempt).catch((error) => {
      this.logger.error(`Email dispatch error: ${String(error)}`);
    });
  }

  private async sendOnce(logId: string, to: string, subject: string, html: string, attempt: number) {
    if (!this.enabled || !this.resend) {
      await this.deliveryLog.markSkipped(logId, 'provider_not_configured');
      this.logger.warn(`Email skipped (not configured): ${subject} -> ${to}`);
      return;
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        ...(this.replyTo ? { reply_to: this.replyTo } : {}),
      });

      await this.deliveryLog.markSent(logId, result.data?.id ?? null);
      this.logger.log(`Email sent: ${subject} -> ${to}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryCount = await this.deliveryLog.incrementRetry(logId);

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS_MS[attempt] ?? 120_000;
        this.logger.warn(`Email retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms: ${subject}`);
        setTimeout(() => {
          void this.sendOnce(logId, to, subject, html, attempt + 1);
        }, delay);
        return;
      }

      await this.deliveryLog.markFailed(logId, 'send_error', message, retryCount);
      this.logger.error(`Email failed after retries: ${subject} -> ${to}`);
    }
  }
}
