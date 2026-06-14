/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import {
  assignmentEmail,
  deliveryConfirmationEmail,
  paymentConfirmationEmail,
  shipmentCreatedEmail,
  shipmentStatusEmail,
  welcomeEmail,
} from './email-templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('email.resendApiKey');
    this.fromEmail = this.config.get<string>('email.from', 'Transit Logistic <noreply@transit-logistic.dev>');
    this.enabled = Boolean(apiKey);
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async send(input: { to: string; subject: string; html: string }) {
    if (!this.enabled || !this.resend) {
      this.logger.warn(`Email skipped (Resend not configured): ${input.subject} -> ${input.to}`);
      return { delivered: false, skipped: true };
    }

    const result = await this.resend.emails.send({
      from: this.fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    return { delivered: true, id: result.data?.id ?? null };
  }

  async sendWelcome(input: { to: string; name: string; locale: 'en' | 'ar' }) {
    return this.send({
      to: input.to,
      subject: input.locale === 'ar' ? 'مرحباً بك في ترانزيت لوجستك' : 'Welcome to Transit Logistic',
      html: welcomeEmail(input.name, input.locale),
    });
  }

  async sendShipmentCreated(input: { to: string; reference: string; locale: 'en' | 'ar' }) {
    return this.send({
      to: input.to,
      subject: input.locale === 'ar' ? 'تم إنشاء الشحنة' : 'Shipment created',
      html: shipmentCreatedEmail(input.reference, input.locale),
    });
  }

  async sendPaymentConfirmation(input: {
    to: string;
    reference: string;
    amount: string;
    currency: string;
    locale: 'en' | 'ar';
  }) {
    return this.send({
      to: input.to,
      subject: input.locale === 'ar' ? 'تأكيد الدفع' : 'Payment confirmation',
      html: paymentConfirmationEmail(input.reference, input.amount, input.currency, input.locale),
    });
  }

  async sendAssignment(input: { to: string; reference: string; locale: 'en' | 'ar' }) {
    return this.send({
      to: input.to,
      subject: input.locale === 'ar' ? 'تم تعيين الشحنة' : 'Shipment assigned',
      html: assignmentEmail(input.reference, input.locale),
    });
  }

  async sendStatusUpdate(input: {
    to: string;
    reference: string;
    statusLabel: string;
    locale: 'en' | 'ar';
  }) {
    return this.send({
      to: input.to,
      subject: input.locale === 'ar' ? 'تحديث الشحنة' : 'Shipment status update',
      html: shipmentStatusEmail(input.reference, input.statusLabel, input.locale),
    });
  }

  async sendDeliveryConfirmation(input: { to: string; reference: string; locale: 'en' | 'ar' }) {
    return this.send({
      to: input.to,
      subject: input.locale === 'ar' ? 'تم التسليم' : 'Delivery confirmation',
      html: deliveryConfirmationEmail(input.reference, input.locale),
    });
  }
}
