import { Suspense } from 'react';

import { VerifyEmailContent } from '@/components/account/verify-email-content';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="container auth-page"><p>Loading…</p></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
