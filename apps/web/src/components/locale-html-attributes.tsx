'use client';

import { useEffect } from 'react';

type LocaleHtmlAttributesProps = {
  locale: string;
  dir: 'ltr' | 'rtl';
};

export function LocaleHtmlAttributes({ locale, dir }: LocaleHtmlAttributesProps) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  return null;
}
