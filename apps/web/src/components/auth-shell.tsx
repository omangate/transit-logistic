'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { BrandLogo } from './brand/brand-logo';
import { LocaleSwitcher } from './locale-switcher';

import { Link } from '@/i18n/navigation';

type AuthShellProps = {
  children: ReactNode;
  title: string;
};

export function AuthShell({ children, title }: AuthShellProps) {
  const auth = useTranslations('auth');

  return (
    <main>
      <header
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingBlock: '1rem',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <Link href="/">
            <BrandLogo size="sm" />
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <section className="container" style={{ paddingBlock: '3rem' }}>
        <Link
          href="/"
          style={{
            color: 'var(--color-muted)',
            fontSize: '0.875rem',
            display: 'inline-block',
            marginBlockEnd: '1.5rem',
          }}
        >
          ← {auth('backHome')}
        </Link>

        <div
          style={{
            maxWidth: '28rem',
            marginInline: 'auto',
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: '0.75rem',
            padding: '2rem',
          }}
        >
          <h1 style={{ fontSize: '1.75rem', marginBlock: '0 1.5rem' }}>{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}
