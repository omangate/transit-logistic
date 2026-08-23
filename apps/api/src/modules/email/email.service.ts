/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable, Logger } from '@nestjs/common';

import {
  assignmentEmail,
  deliveryConfirmationEmail,
  paymentConfirmationEmail,
  shipmentCreatedEmail,
  shipmentStatusEmail,
  welcomeEmail,
} from './email-templates';
import { EmailTransportService } from './email-transport.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly transport: EmailTransportService) {}

  async send(input: { to: string; subject: string; html: string }) {
    if (!this.transport.isConfigured()) {
      this.logger.warn(`Email skipped (provider not configured): ${input.subject} -> ${input.to}`);
      return { delivered: false, skipped: true };
    }

    try {
      const result = await this.transport.send(input);
      return { delivered: true, id: result.providerMessageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Email send failed: ${input.subject} -> ${input.to} (${message})`);
      return { delivered: false, skipped: true };
    }
  }

  isConfigured(): boolean {
    return this.transport.isConfigured();
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
