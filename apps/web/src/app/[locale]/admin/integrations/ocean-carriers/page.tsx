import { setRequestLocale } from 'next-intl/server';

import { AdminOceanCarriersContent } from '@/components/admin/admin-ocean-carriers-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminOceanCarriersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminOceanCarriersContent />;
}
