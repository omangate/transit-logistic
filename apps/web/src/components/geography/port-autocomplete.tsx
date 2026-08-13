'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { searchPorts } from '@/lib/api';
import type { PortSearchResult } from '@/types/port';

type PortAutocompleteProps = {
  label: string;
  value: string;
  unlocode?: string;
  onChange: (display: string, port: PortSearchResult | null) => void;
  required?: boolean;
  placeholder?: string;
};

export function PortAutocomplete({
  label,
  value,
  unlocode,
  onChange,
  required,
  placeholder,
}: PortAutocompleteProps) {
  const t = useTranslations('ports');
  const locale = useLocale();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PortSearchResult[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchPorts(query)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const labelFor = (port: PortSearchResult) =>
    locale === 'ar' ? port.nameAr : port.nameEn;

  return (
    <div className="port-autocomplete">
      <label>
        {label}
        <input
          type="text"
          value={query}
          required={required}
          placeholder={placeholder ?? t('placeholder')}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(event.target.value, null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </label>
      {unlocode ? <span className="port-autocomplete__code">{unlocode}</span> : null}
      {open && results.length > 0 ? (
        <ul className="port-autocomplete__results">
          {results.map((port) => (
            <li key={port.unlocode}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const display = `${labelFor(port)} (${port.unlocode})`;
                  setQuery(display);
                  onChange(display, port);
                  setOpen(false);
                }}
              >
                <strong>{port.unlocode}</strong>
                <span>{labelFor(port)}</span>
                <span className="muted-text">{port.countryCode}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
