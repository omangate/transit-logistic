import { setRequestLocale } from 'next-intl/server';



import { FleetWalletContent } from '@/components/fleet/fleet-wallet-content';



type Props = {

  params: Promise<{ locale: string }>;

};



export default async function FleetWalletPage({ params }: Props) {

  const { locale } = await params;

  setRequestLocale(locale);



  return <FleetWalletContent />;

}


