'use client';

import { useTranslations } from 'next-intl';

import { FleetShell } from '@/components/fleet/fleet-shell';
import { FleetTruckListingForm } from '@/components/fleet/fleet-truck-listing-form';
import { LoadingState } from '@/components/portal/loading-state';
import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';

type Props = {
  listingId?: string;
};

export function FleetTruckListingFormPage({ listingId }: Props) {
  const t = useTranslations('marketplace');
  const { user, isReady } = useRequireFleetAuth();

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <FleetShell
      user={user}
      title={listingId ? t('form.editTitle') : t('form.createTitle')}
      subtitle={t('fleet.subtitle')}
    >
      <FleetTruckListingForm listingId={listingId} />
    </FleetShell>
  );
}
