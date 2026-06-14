import { setRequestLocale } from 'next-intl/server';

import { AdminDriversContent } from '@/components/admin/admin-drivers-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminDriversPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminDriversContent />;
}
