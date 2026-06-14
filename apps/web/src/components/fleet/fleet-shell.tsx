'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '../locale-switcher';

import { FleetSidebar } from './fleet-sidebar';

import { useRouter } from '@/i18n/navigation';
import { clearAuthSession } from '@/lib/auth-storage';
import type { AuthUser } from '@/types/auth';

type FleetShellProps = {
  children: ReactNode;
  user: AuthUser;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function FleetShell({ children, user, title, subtitle, action }: FleetShellProps) {
  const t = useTranslations('fleet');
  const router = useRouter();

  return (
    <div className="portal-layout">
      <FleetSidebar />
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
