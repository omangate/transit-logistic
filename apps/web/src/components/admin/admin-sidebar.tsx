'use client';

import { useTranslations } from 'next-intl';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Link, usePathname } from '@/i18n/navigation';

const NAV_ITEMS = [
  { href: '/admin/dashboard', labelKey: 'nav.dashboard' as const },
  { href: '/admin/shipments', labelKey: 'nav.shipments' as const },
  { href: '/admin/customers', labelKey: 'nav.customers' as const },
  { href: '/admin/fleet-owners', labelKey: 'nav.fleetOwners' as const },
  { href: '/admin/drivers', labelKey: 'nav.drivers' as const },
  { href: '/admin/vehicles', labelKey: 'nav.vehicles' as const },
  { href: '/admin/payments', labelKey: 'nav.payments' as const },
  { href: '/admin/payouts', labelKey: 'nav.payouts' as const },
  { href: '/admin/ratings', labelKey: 'nav.ratings' as const },
  { href: '/admin/settings', labelKey: 'nav.settings' as const },
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
      <nav className="portal-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavActive(pathname, item.href);

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
  );
}
