import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/components/auth-shell';
import { RegisterForm } from '@/components/register-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <AuthShell title={t('registerTitle')}>
      <RegisterForm />
    </AuthShell>
  );
}
