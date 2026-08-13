'use client';

import { UserRole } from '@transit-logistic/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { getUnreadNotificationsCount } from '@/lib/api';

type NavItem = {
  href: string;
  labelKey: string;
  isBell?: boolean;
  mobileOnly?: boolean;
};

type NavGroup = {
  id: string;
  labelKey: string;
  defaultOpen?: boolean;
  items: NavItem[];
};

const CUSTOMER_NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    labelKey: 'nav.groups.overview',
    defaultOpen: true,
    items: [{ href: '/dashboard', labelKey: 'nav.dashboard' }],
  },
  {
    id: 'shipments',
    labelKey: 'nav.groups.shipments',
    defaultOpen: true,
    items: [
      { href: '/shipments', labelKey: 'nav.shipments' },
      { href: '/track', labelKey: 'nav.globalTracking' },
      { href: '/shipments/new', labelKey: 'nav.newShipment' },
    ],
  },
  {
    id: 'logistics',
    labelKey: 'nav.groups.logistics',
    defaultOpen: true,
    items: [
      { href: '/logistics', labelKey: 'nav.logisticsOrders' },
      { href: '/freight/shipments', labelKey: 'nav.oceanFreight' },
      { href: '/customs/requests', labelKey: 'nav.customs' },
      { href: '/freight/request', labelKey: 'nav.quotations' },
    ],
  },
  {
    id: 'resources',
    labelKey: 'nav.groups.resources',
    items: [
      { href: '/ocean/carriers', labelKey: 'nav.carriers' },
      { href: '/ocean/schedules', labelKey: 'nav.schedules' },
      { href: '/logistics', labelKey: 'nav.containers' },
      { href: '/documents', labelKey: 'nav.documents' },
      { href: '/payments', labelKey: 'nav.payments' },
    ],
  },
  {
    id: 'marketplace',
    labelKey: 'nav.groups.marketplace',
    items: [
      { href: '/marketplace', labelKey: 'nav.marketplace' },
    ],
  },
  {
    id: 'communication',
    labelKey: 'nav.groups.communication',
    items: [
      { href: '/notifications', labelKey: 'nav.notifications', isBell: true },
      { href: '/logistics', labelKey: 'nav.messages' },
      { href: '/ai', labelKey: 'nav.aiAssistant' },
    ],
  },
  {
    id: 'account',
    labelKey: 'nav.groups.account',
    items: [{ href: '/account/notifications', labelKey: 'nav.account' }],
  },
];

const MOBILE_PRIMARY_HREFS = [
  '/dashboard',
  '/shipments',
  '/track',
  '/logistics',
  '/notifications',
  '/account/notifications',
];

const FLEET_HIDDEN_HREFS = new Set([
  '/logistics',
  '/customs/requests',
  '/freight/shipments',
  '/freight/quote',
  '/shipments/new',
  '/ocean/carriers',
  '/ocean/schedules',
]);

function isNavActive(pathname: string, href: string) {
  if (href === '/shipments') {
    return pathname === '/shipments' || (pathname.startsWith('/shipments/') && pathname !== '/shipments/new');
  }
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ role }: { role?: string }) {
  const t = useTranslations('portal');
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const navGroups = useMemo(() => {
    if (role === UserRole.FLEET_OWNER || role === UserRole.DRIVER) {
      return CUSTOMER_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !FLEET_HIDDEN_HREFS.has(item.href)),
      })).filter((group) => group.items.length > 0);
    }
    return CUSTOMER_NAV_GROUPS;
  }, [role]);

  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    for (const group of navGroups) {
      defaults[group.id] = group.defaultOpen ?? false;
    }
    setOpenGroups(defaults);
  }, [navGroups]);

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

  const mobileItems = navGroups
    .flatMap((group) => group.items)
    .filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href));

  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar__brand">
        <BrandLogo variant="light" size="sm" />
      </div>
      <nav className="portal-sidebar__nav" aria-label={t('nav.main')}>
        {navGroups.map((group) => {
          const isOpen = openGroups[group.id] ?? false;
          const hasActiveItem = group.items.some((item) => isNavActive(pathname, item.href));

          return (
            <div key={group.id} className="portal-sidebar__group">
              <button
                type="button"
                className="portal-sidebar__group-toggle"
                aria-expanded={isOpen || hasActiveItem}
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.id]: !current[group.id],
                  }))
                }
              >
                <span>{t(group.labelKey)}</span>
                <span aria-hidden="true">{isOpen || hasActiveItem ? '−' : '+'}</span>
              </button>
              {(isOpen || hasActiveItem) && (
                <div className="portal-sidebar__group-items">
                  {group.items.map((item) => (
                    <Link
                      key={`${group.id}-${item.labelKey}`}
                      href={item.href}
                      className={`portal-sidebar__link${isNavActive(pathname, item.href) ? ' portal-sidebar__link--active' : ''}`}
                    >
                      {item.isBell ? (
                        <span className="sidebar-bell">
                          {t(item.labelKey)}
                          {unreadCount > 0 ? (
                            <span className="sidebar-bell__badge">{unreadCount}</span>
                          ) : null}
                        </span>
                      ) : (
                        t(item.labelKey)
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <nav className="mobile-bottom-nav" aria-label={t('nav.mobile')}>
        {mobileItems.map((item) => (
          <Link
            key={`mobile-${item.href}`}
            href={item.href}
            className={`portal-sidebar__link${isNavActive(pathname, item.href) ? ' portal-sidebar__link--active' : ''}`}
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
