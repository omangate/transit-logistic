'use client';

import { UserRole } from '@transit-logistic/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { getUnreadNotificationsCount } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'nav.dashboard' as const },
  { href: '/logistics', labelKey: 'nav.logistics' as const },
  { href: '/customs/requests', labelKey: 'nav.customs' as const },
  { href: '/freight/shipments', labelKey: 'nav.freight' as const },
  { href: '/shipments', labelKey: 'nav.shipments' as const },
  { href: '/shipments/new', labelKey: 'nav.newShipment' as const },
  { href: '/marketplace', labelKey: 'nav.marketplace' as const },
  { href: '/notifications', labelKey: 'nav.notifications' as const, isBell: true },
  { href: '/account/notifications', labelKey: 'nav.account' as const },
];

const CUSTOMER_LOGISTICS_HREFS = new Set([
  '/logistics',
  '/customs/requests',
  '/freight/shipments',
  '/shipments',
  '/shipments/new',
]);

function navItemsForRole(role?: string) {
  if (role === UserRole.CUSTOMER || role === UserRole.ADMIN || !role) {
    return NAV_ITEMS;
  }
  return NAV_ITEMS.filter((item) => !CUSTOMER_LOGISTICS_HREFS.has(item.href));
}

export function Sidebar({ role }: { role?: string }) {
  const t = useTranslations('portal');
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const items = navItemsForRole(role);

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
        {items.map((item) => {
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
