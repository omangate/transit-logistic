import { setRequestLocale } from 'next-intl/server';



import { AdminPayoutsContent } from '@/components/admin/admin-payouts-content';



type Props = {

  params: Promise<{ locale: string }>;

};



export default async function AdminPayoutsPage({ params }: Props) {

  const { locale } = await params;

  setRequestLocale(locale);



  return <AdminPayoutsContent />;

}


