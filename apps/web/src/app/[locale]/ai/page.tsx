import { setRequestLocale } from 'next-intl/server';

import { AiAssistantPageContent } from '@/components/ai/ai-assistant-page-content';

type Props = { params: Promise<{ locale: string }> };

export default async function AiAssistantPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AiAssistantPageContent />;
}
