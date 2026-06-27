'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { listMyQuoteRequests } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { TruckQuoteRequest } from '@/types/marketplace';

export function CustomerQuotesContent() {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [quotes, setQuotes] = useState<TruckQuoteRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !user) return;
    void listMyQuoteRequests()
      .then(setQuotes)
      .catch((err) => {
        setError(
          isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
        );
      });
  }, [isReady, user, locale, t]);

  if (!isReady) return <main className="container"><p>{t('loading')}</p></main>;
  if (!user) return <main className="container"><p>{t('quotes.loginRequired')}</p></main>;

  return (
    <main>
      <header className="marketplace-hero">
        <div className="container">
          <h1>{t('quotes.myQuotes')}</h1>
        </div>
      </header>
      <section className="container">
        {error ? <p className="form-error">{error}</p> : null}
        {quotes.length === 0 ? <p>{t('quotes.empty')}</p> : null}
        <div className="fleet-rental-quotes__list">
          {quotes.map((quote) => (
            <article key={quote.id} className="fleet-rental-quotes__item">
              <div>
                <strong>{quote.truckListing?.name}</strong>
                <p>{quote.originCity} → {quote.destCity}</p>
                {quote.fleetResponse ? <p>{quote.fleetResponse}</p> : null}
              </div>
              <div>
                <span className={`rental-status rental-status--${quote.status}`}>{quote.status}</span>
                {quote.truckListing?.slug ? (
                  <Link href={`/marketplace/trucks/${quote.truckListing.slug}`} className="rental-btn rental-btn--ghost">
                    {t('rental.viewDetails')}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
