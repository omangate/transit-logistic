import { setRequestLocale } from 'next-intl/server';

import { AdminShipmentsListContent } from '@/components/admin/admin-shipments-list-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminShipmentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminShipmentsListContent />;
}
