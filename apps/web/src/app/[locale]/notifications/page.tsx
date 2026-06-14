import { setRequestLocale } from 'next-intl/server';

import { NotificationsContent } from '@/components/notifications/notifications-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <NotificationsContent />;
}
