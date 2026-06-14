'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '../locale-switcher';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { clearAuthSession } from '@/lib/auth-storage';
import type { AuthUser } from '@/types/auth';

const NAV_ITEMS = [
  { href: '/driver/dashboard', labelKey: 'nav.dashboard' as const },
];

type DriverShellProps = {
  children: ReactNode;
  user: AuthUser;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function DriverShell({ children, user, title, subtitle, action }: DriverShellProps) {
  const t = useTranslations('driver');
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <div className="portal-sidebar__brand">
          <BrandLogo variant="light" size="sm" />
        </div>
        <nav className="portal-sidebar__nav">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith('/driver/shipments/');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`portal-sidebar__link${isActive ? ' portal-sidebar__link--active' : ''}`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="portal-main">
        <header className="portal-header">
          <div className="portal-header__titles">
            <h1 className="portal-header__title">{title}</h1>
            {subtitle ? <p className="portal-header__subtitle">{subtitle}</p> : null}
          </div>
          <div className="portal-header__actions">
            {action}
            <span className="portal-header__user">{user.email}</span>
            <LocaleSwitcher />
            <button
              type="button"
              className="portal-button portal-button--ghost"
              onClick={() => {
                clearAuthSession();
                router.replace('/login');
              }}
            >
              {t('logout')}
            </button>
          </div>
        </header>
        <div className="portal-content">{children}</div>
      </div>
    </div>
  );
}
