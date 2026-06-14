'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '../locale-switcher';

import { AdminSidebar } from './admin-sidebar';

import { useRouter } from '@/i18n/navigation';
import { clearAuthSession } from '@/lib/auth-storage';
import type { AuthUser } from '@/types/auth';

type AdminShellProps = {
  children: ReactNode;
  user: AuthUser;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function AdminShell({ children, user, title, subtitle, action }: AdminShellProps) {
  const t = useTranslations('admin');
  const router = useRouter();

  return (
    <div className="portal-layout">
      <AdminSidebar />
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
