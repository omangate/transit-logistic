'use client';

import { useTranslations } from 'next-intl';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Link, usePathname } from '@/i18n/navigation';

const NAV_GROUPS = [
  {
    id: 'operations',
    labelKey: 'nav.groups.operations',
    items: [
      { href: '/admin/dashboard', labelKey: 'nav.dashboard' },
      { href: '/admin/operations', labelKey: 'nav.operationsTower' },
      { href: '/admin/shipments', labelKey: 'nav.shipments' },
      { href: '/admin/logistics', labelKey: 'nav.logistics' },
    ],
  },
  {
    id: 'network',
    labelKey: 'nav.groups.network',
    items: [
      { href: '/admin/customers', labelKey: 'nav.customers' },
      { href: '/admin/fleet-owners', labelKey: 'nav.fleetOwners' },
      { href: '/admin/drivers', labelKey: 'nav.drivers' },
      { href: '/admin/vehicles', labelKey: 'nav.vehicles' },
      { href: '/admin/marketplace', labelKey: 'nav.marketplace' },
    ],
  },
  {
    id: 'finance',
    labelKey: 'nav.groups.finance',
    items: [
      { href: '/admin/payments', labelKey: 'nav.payments' },
      { href: '/admin/payouts', labelKey: 'nav.payouts' },
      { href: '/admin/ratings', labelKey: 'nav.ratings' },
    ],
  },
  {
    id: 'integrations',
    labelKey: 'nav.groups.integrations',
    items: [{ href: '/admin/integrations/ocean-carriers', labelKey: 'nav.oceanCarriers' }],
  },
  {
    id: 'system',
    labelKey: 'nav.groups.system',
    items: [{ href: '/admin/settings', labelKey: 'nav.settings' }],
  },
];

function isNavActive(pathname: string, href: string) {
  if (href === '/admin/dashboard') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const t = useTranslations('admin');
  const pathname = usePathname();

  return (
    <aside className="portal-sidebar admin-sidebar">
      <div className="portal-sidebar__brand">
        <BrandLogo variant="light" size="sm" />
      </div>
      <nav className="portal-sidebar__nav" aria-label={t('nav.main')}>
        {NAV_GROUPS.map((group) => {
          return (
            <div key={group.id} className="portal-sidebar__group">
              <div className="portal-sidebar__group-label">{t(group.labelKey)}</div>
              <div className="portal-sidebar__group-items">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`portal-sidebar__link${isNavActive(pathname, item.href) ? ' portal-sidebar__link--active' : ''}`}
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
