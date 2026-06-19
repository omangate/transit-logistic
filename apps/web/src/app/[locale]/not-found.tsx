import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function LocaleNotFound() {
  const t = await getTranslations('common');

  return (
    <main className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
      <h1>404</h1>
      <p>Page not found</p>
      <Link href="/">{t('appName')}</Link>
    </main>
  );
}
