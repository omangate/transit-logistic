'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormError } from '@/components/form-error';
import { PortAutocomplete } from '@/components/geography/port-autocomplete';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { searchOceanSchedules } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate } from '@/lib/shipment-utils';
import type { NormalizedSailingSchedule } from '@/types/ocean';

export function ScheduleSearchContent() {
  const t = useTranslations('oceanSchedules');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originUnlocode, setOriginUnlocode] = useState('');
  const [destinationUnlocode, setDestinationUnlocode] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [containerType, setContainerType] = useState('40HC');
  const [directOnly, setDirectOnly] = useState(false);
  const [results, setResults] = useState<NormalizedSailingSchedule[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <section className="panel">
        <form
          className="track-form"
          onSubmit={(event) => {
            event.preventDefault();
            setIsLoading(true);
            setError(null);
            void searchOceanSchedules({
              originUnlocode: originUnlocode || origin.trim().toUpperCase(),
              destinationUnlocode: destinationUnlocode || destination.trim().toUpperCase(),
              departureDate: departureDate || undefined,
              containerType,
              directOnly,
            })
              .then((rows) => {
                setResults(rows);
                setSearched(true);
              })
              .catch((loadError) => {
                setResults([]);
                setSearched(true);
                setError(
                  isApiClientError(loadError)
                    ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
                    : tPortal('errors.generic'),
                );
              })
              .finally(() => setIsLoading(false));
          }}
        >
          <div className="form-grid">
            <PortAutocomplete
              label={t('origin')}
              value={origin}
              unlocode={originUnlocode}
              onChange={(display, port) => {
                setOrigin(display);
                setOriginUnlocode(port?.unlocode ?? '');
              }}
              required
            />
            <PortAutocomplete
              label={t('destination')}
              value={destination}
              unlocode={destinationUnlocode}
              onChange={(display, port) => {
                setDestination(display);
                setDestinationUnlocode(port?.unlocode ?? '');
              }}
              required
            />
            <label>
              <span>{t('departureDate')}</span>
              <input
                type="date"
                value={departureDate}
                onChange={(event) => setDepartureDate(event.target.value)}
              />
            </label>
            <label>
              <span>{t('containerType')}</span>
              <select value={containerType} onChange={(event) => setContainerType(event.target.value)}>
                <option value="20GP">20GP</option>
                <option value="40GP">40GP</option>
                <option value="40HC">40HC</option>
              </select>
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={directOnly}
              onChange={(event) => setDirectOnly(event.target.checked)}
            />
            <span>{t('directOnly')}</span>
          </label>
          <button type="submit" className="portal-button portal-button--primary" disabled={isLoading}>
            {isLoading ? t('searching') : t('search')}
          </button>
        </form>
      </section>

      <FormError message={error} />

      {searched && !isLoading && results.length === 0 ? (
        <div className="empty-state">
          <p>{t('empty')}</p>
          <p className="muted-text">{t('emptyHint')}</p>
        </div>
      ) : null}

      {results.length > 0 ? (
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.carrier')}</th>
                  <th>{t('table.vessel')}</th>
                  <th>{t('table.pol')}</th>
                  <th>{t('table.pod')}</th>
                  <th>{t('table.etd')}</th>
                  <th>{t('table.eta')}</th>
                  <th>{t('table.transit')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr key={`${row.carrierCode}-${row.voyage}-${index}`}>
                    <td>{row.carrierName}</td>
                    <td>
                      {row.vesselName} / {row.voyage}
                    </td>
                    <td>{row.pol.unlocode ?? row.pol.name}</td>
                    <td>{row.pod.unlocode ?? row.pod.name}</td>
                    <td>{formatDate(row.etd, locale)}</td>
                    <td>{formatDate(row.eta, locale)}</td>
                    <td>{row.transitDays ?? '—'}</td>
                    <td>
                      <Link href="/freight/request" className="portal-link">
                        {t('requestQuote')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </PortalShell>
  );
}
