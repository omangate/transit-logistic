'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { getUnreadNotificationsCount } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'nav.dashboard' as const },
  { href: '/shipments', labelKey: 'nav.shipments' as const },
  { href: '/shipments/new', labelKey: 'nav.newShipment' as const },
  { href: '/notifications', labelKey: 'nav.notifications' as const, isBell: true },
];

export function Sidebar() {
  const t = useTranslations('portal');
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const result = await getUnreadNotificationsCount();
        if (!cancelled) {
          setUnreadCount(result.unreadCount);
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
        }
      }
    }

    void loadUnreadCount();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar__brand">
        <BrandLogo variant="light" size="sm" />
      </div>
      <nav className="portal-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/shipments'
              ? pathname === '/shipments' ||
                (pathname.startsWith('/shipments/') && pathname !== '/shipments/new')
              : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`portal-sidebar__link${isActive ? ' portal-sidebar__link--active' : ''}`}
            >
              {item.isBell ? (
                <span className="sidebar-bell">
                  <span aria-hidden="true">🔔</span>
                  {t(item.labelKey)}
                  {unreadCount > 0 ? (
                    <span className="sidebar-bell__badge">{unreadCount}</span>
                  ) : null}
                </span>
              ) : (
                t(item.labelKey)
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
