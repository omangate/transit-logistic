'use client';

import type { ReactNode } from 'react';

import { AiChatWidget } from '@/components/ai/ai-chat-widget';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AiChatWidget />
    </>
  );
}
