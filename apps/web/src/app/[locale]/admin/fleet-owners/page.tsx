import { setRequestLocale } from 'next-intl/server';

import { AdminFleetOwnersContent } from '@/components/admin/admin-fleet-owners-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminFleetOwnersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminFleetOwnersContent />;
}
