import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <AuthShell title={t('loginTitle')}>
      <LoginForm />
    </AuthShell>
  );
}
