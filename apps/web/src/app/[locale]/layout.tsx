import { LOCALE_DIRECTION, SUPPORTED_LOCALES, type SupportedLocale } from '@transit-logistic/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleHtmlAttributes } from '@/components/locale-html-attributes';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });

  return {
    title: t('appName'),
    description: t('tagline'),
    icons: {
      icon: '/favicon.svg',
      shortcut: '/favicon.svg',
      apple: '/favicon.svg',
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const direction = LOCALE_DIRECTION[locale as SupportedLocale];

  return (
    <>
      <LocaleHtmlAttributes locale={locale} dir={direction} />
      <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
    </>
  );
}
