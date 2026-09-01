import { CustomsDeclarationPrepContent } from '@/components/logistics/customs-declaration-prep-content';

type PageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function AdminCustomsPreparePage({ params }: PageProps) {
  const { id } = await params;
  return <CustomsDeclarationPrepContent requestId={id} />;
}
