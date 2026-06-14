import { setRequestLocale } from 'next-intl/server';



import { ShipmentEditContent } from '@/components/shipments/shipment-edit-content';



type Props = {

  params: Promise<{ locale: string; id: string }>;

};



export default async function ShipmentEditPage({ params }: Props) {

  const { locale, id } = await params;

  setRequestLocale(locale);



  return <ShipmentEditContent shipmentId={id} />;

}


