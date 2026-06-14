import { setRequestLocale } from 'next-intl/server';

import { AdminVehiclesContent } from '@/components/admin/admin-vehicles-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminVehiclesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminVehiclesContent />;
}
