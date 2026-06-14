import { setRequestLocale } from 'next-intl/server';



import { FleetRatingsContent } from '@/components/fleet/fleet-ratings-content';



type Props = {

  params: Promise<{ locale: string }>;

};



export default async function FleetRatingsPage({ params }: Props) {

  const { locale } = await params;

  setRequestLocale(locale);



  return <FleetRatingsContent />;

}


