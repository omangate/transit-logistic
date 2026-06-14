import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderType } from '@transit-logistic/shared';

import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { ShipmentsModule } from '../shipments/shipments.module';

import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { MyFatoorahPaymentProvider } from './providers/myfatoorah-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import { ThawaniPaymentProvider } from './providers/thawani-payment.provider';

@Module({
  imports: [ShipmentsModule, NotificationsModule, SettingsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    ThawaniPaymentProvider,
    MyFatoorahPaymentProvider,
    StripePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [
        ConfigService,
        MockPaymentProvider,
        ThawaniPaymentProvider,
        MyFatoorahPaymentProvider,
        StripePaymentProvider,
      ],
      useFactory: (
        config: ConfigService,
        mockProvider: MockPaymentProvider,
        thawaniProvider: ThawaniPaymentProvider,
        myfatoorahProvider: MyFatoorahPaymentProvider,
        stripeProvider: StripePaymentProvider,
      ) => {
        const provider = config.get<string>('payment.provider', PaymentProviderType.THAWANI);

        switch (provider) {
          case PaymentProviderType.STRIPE:
            return stripeProvider;
          case PaymentProviderType.MYFATOORAH:
            return myfatoorahProvider;
          case PaymentProviderType.THAWANI:
            return thawaniProvider;
          case PaymentProviderType.MOCK:
            return mockProvider;
          default:
            return thawaniProvider;
        }
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
