'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { fetchHsTariffStats, importHsTariffFile, searchHsTariff } from '@/lib/api';

export function OmanHsTariffAdminContent() {
  const t = useTranslations('logistics.customsPrep');
  const { user, isReady } = useRequireAdminAuth();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchHsTariffStats>> | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ hsCode: string; descriptionEn: string; descriptionAr: string; dutyRate?: string | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStats(await fetchHsTariffStats());
  }, []);

  useEffect(() => {
    if (!isReady || user?.role !== 'admin') return;
    void reload();
  }, [isReady, reload, user?.role]);

  const onSearch = async () => {
    const data = await searchHsTariff(query);
    setResults(data.results ?? []);
  };

  const onImport = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      await importHsTariffFile(file);
      await reload();
      setMessage(t('hsImportSuccess'));
    } catch {
      setMessage(t('hsImportFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!isReady || user?.role !== 'admin') return null;

  return (
    <AdminShell user={user} title={t('hsAdminTitle')} subtitle={t('hsAdminSubtitle')}>
      {stats ? (
        <section className="customs-prep__panel">
          <p>{t('hsTotalRecords', { count: stats.totalRecords })}</p>
          <p>{t('hsOfficialRecords', { count: stats.officialRecords })}</p>
          <p>{t('hsTariffVersion', { version: stats.activeTariffVersion ?? '—', year: stats.tariffYear ?? '—' })}</p>
          {!stats.datasetComplete ? <p className="customs-prep__warn">{stats.completenessMessage}</p> : null}
        </section>
      ) : null}

      <section className="customs-prep__panel">
        <label>{t('hsImportLabel')}</label>
        <input type="file" accept=".json,.csv,.xlsx,.xls" disabled={busy} onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])} />
        {message ? <p>{message}</p> : null}
      </section>

      <section className="customs-prep__panel">
        <div className="customs-prep__search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('hsSearchPlaceholder')} />
          <button type="button" className="rental-btn" onClick={() => void onSearch()}>{t('hsSearch')}</button>
        </div>
        <ul className="customs-prep__hs-list">
          {results.map((row) => (
            <li key={row.hsCode}>
              <strong>{row.hsCode}</strong> — {row.descriptionEn}
              {row.dutyRate ? ` (${row.dutyRate})` : ''}
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
