import Link from 'next/link';

import { routing } from '@/i18n/routing';

export default function NotFound() {
  return (
    <main className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
      <h1>404</h1>
      <p>Page not found</p>
      <Link href={`/${routing.defaultLocale}`}>Go home</Link>
    </main>
  );
}
