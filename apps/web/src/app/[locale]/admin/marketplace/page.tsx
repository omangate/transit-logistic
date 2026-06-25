import { setRequestLocale } from 'next-intl/server';

import { AdminMarketplaceContent } from '@/components/admin/admin-marketplace-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminMarketplacePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminMarketplaceContent />;
}
