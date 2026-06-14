import { setRequestLocale } from 'next-intl/server';



import { FleetPayoutsContent } from '@/components/fleet/fleet-payouts-content';



type Props = {

  params: Promise<{ locale: string }>;

};



export default async function FleetPayoutsPage({ params }: Props) {

  const { locale } = await params;

  setRequestLocale(locale);



  return <FleetPayoutsContent />;

}


