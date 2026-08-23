import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

import type { Transporter } from 'nodemailer';

export type EmailSendResult = {
  providerMessageId: string | null;
};

@Injectable()
export class EmailTransportService {
  private readonly logger = new Logger(EmailTransportService.name);
  private readonly provider: string;
  private readonly fromEmail: string;
  private readonly replyTo?: string;
  private readonly resend: Resend | null;
  private readonly smtpTransporter: Transporter | null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('email.provider', 'resend').toLowerCase();
    this.fromEmail = this.config.get<string>('email.from', 'Transit Logistic <noreply@transit-logistic.dev>');
    this.replyTo = this.config.get<string>('email.replyTo');

    const resendApiKey = this.config.get<string>('email.resendApiKey');
    this.resend = this.provider === 'resend' && resendApiKey ? new Resend(resendApiKey) : null;

    if (this.provider === 'smtp' && this.hasSmtpCredentials()) {
      this.smtpTransporter = nodemailer.createTransport({
        host: this.config.get<string>('email.smtp.host'),
        port: this.config.get<number>('email.smtp.port', 587),
        secure: this.config.get<boolean>('email.smtp.secure', false),
        auth: {
          user: this.config.get<string>('email.smtp.user'),
          pass: this.config.get<string>('email.smtp.password'),
        },
      });
    } else {
      this.smtpTransporter = null;
    }

    this.enabled =
      (this.provider === 'resend' && Boolean(this.resend)) ||
      (this.provider === 'smtp' && Boolean(this.smtpTransporter));
  }

  getProvider(): string {
    return this.provider;
  }

  isConfigured(): boolean {
    return this.enabled;
  }

  getFromAddress(): string {
    return this.fromEmail;
  }

  getReplyTo(): string | undefined {
    return this.replyTo;
  }

  getMissingCredentials(): string[] {
    const missing: string[] = [];
    const from = this.config.get<string>('email.from');

    if (!from?.trim()) {
      missing.push('EMAIL_FROM');
    }

    if (this.provider === 'resend') {
      if (!this.config.get<string>('email.resendApiKey')?.trim()) {
        missing.push('RESEND_API_KEY');
      }
      return missing;
    }

    if (this.provider === 'smtp') {
      if (!this.config.get<string>('email.smtp.host')?.trim()) {
        missing.push('SMTP_HOST');
      }
      if (!this.config.get<string>('email.smtp.user')?.trim()) {
        missing.push('SMTP_USER');
      }
      if (!this.config.get<string>('email.smtp.password')?.trim()) {
        missing.push('SMTP_PASSWORD');
      }
    }

    return missing;
  }

  async send(input: { to: string; subject: string; html: string }): Promise<EmailSendResult> {
    if (!this.enabled) {
      throw new Error('email_provider_not_configured');
    }

    if (this.provider === 'smtp') {
      return this.sendViaSmtp(input);
    }

    return this.sendViaResend(input);
  }

  private hasSmtpCredentials(): boolean {
    return Boolean(
      this.config.get<string>('email.smtp.host')?.trim() &&
        this.config.get<string>('email.smtp.user')?.trim() &&
        this.config.get<string>('email.smtp.password')?.trim(),
    );
  }

  private async sendViaResend(input: { to: string; subject: string; html: string }): Promise<EmailSendResult> {
    if (!this.resend) {
      throw new Error('resend_not_configured');
    }

    const result = await this.resend.emails.send({
      from: this.fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(this.replyTo ? { reply_to: this.replyTo } : {}),
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { providerMessageId: result.data?.id ?? null };
  }

  private async sendViaSmtp(input: { to: string; subject: string; html: string }): Promise<EmailSendResult> {
    if (!this.smtpTransporter) {
      throw new Error('smtp_not_configured');
    }

    const info = await this.smtpTransporter.sendMail({
      from: this.fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
    });

    this.logger.log(`Email accepted by SMTP: ${input.subject} -> ${input.to}`);
    return { providerMessageId: info.messageId ?? null };
  }
}
