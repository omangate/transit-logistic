'use client';

import { useTranslations } from 'next-intl';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Link, usePathname } from '@/i18n/navigation';

const NAV_ITEMS = [
  { href: '/fleet/dashboard', labelKey: 'nav.dashboard' as const },
  { href: '/fleet/shipments', labelKey: 'nav.shipments' as const },
  { href: '/fleet/drivers', labelKey: 'nav.drivers' as const },
  { href: '/fleet/vehicles', labelKey: 'nav.vehicles' as const },
  { href: '/fleet/wallet', labelKey: 'nav.wallet' as const },
  { href: '/fleet/payouts', labelKey: 'nav.payouts' as const },
  { href: '/fleet/ratings', labelKey: 'nav.ratings' as const },
];

export function FleetSidebar() {
  const t = useTranslations('fleet');
  const pathname = usePathname();

  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar__brand">
        <BrandLogo variant="light" size="sm" />
      </div>
      <nav className="portal-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/fleet/shipments'
              ? pathname === '/fleet/shipments' || pathname.startsWith('/fleet/shipments/')
              : item.href === '/fleet/wallet'
                ? pathname === '/fleet/wallet'
                : item.href === '/fleet/payouts'
                  ? pathname === '/fleet/payouts'
                  : item.href === '/fleet/ratings'
                    ? pathname === '/fleet/ratings'
                    : pathname === item.href;

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
