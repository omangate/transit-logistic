import type { ReactNode } from 'react';

import './globals.css';

import { getServerApiBaseUrl } from '@/lib/api-config';

export default function RootLayout({ children }: { children: ReactNode }) {
  const apiBaseUrl = getServerApiBaseUrl();
  const runtimeEnvScript =
    apiBaseUrl.length > 0
      ? `window.__ENV=${JSON.stringify({ NEXT_PUBLIC_API_URL: apiBaseUrl })}`
      : null;

  return (
    <html suppressHydrationWarning>
      <head>
        {runtimeEnvScript ? (
          <script dangerouslySetInnerHTML={{ __html: runtimeEnvScript }} />
        ) : null}
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
