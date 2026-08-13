'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { sendAiChat } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: Array<{ tool: string; result: unknown }>;
};

const PROMPTS_EN = [
  'Where is my shipment?',
  'Track container status',
  'What documents are missing?',
  'Show my customs requests',
  'Search sailing schedules',
  'Outstanding payments',
];

const PROMPTS_AR = [
  'أين شحنتي؟',
  'تتبع حالة الحاوية',
  'ما المستندات الناقصة؟',
  'اعرض طلبات الجمارك',
  'ابحث عن جداول الإبحار',
  'المدفوعات المستحقة',
];

export function AiAssistantPageContent() {
  const t = useTranslations('ai');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  const prompts = locale === 'ar' ? PROMPTS_AR : PROMPTS_EN;

  const send = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: text }]);
    setInput('');
    try {
      const res = await sendAiChat({ message: text, sessionId, locale });
      setSessionId(res.sessionId);
      setMessages((m) => [
        ...m,
        {
          id: res.message.id,
          role: 'assistant',
          content: res.message.content,
          cards: res.cards as ChatMessage['cards'],
        },
      ]);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalShell user={user} title={t('pageTitle')} subtitle={t('pageSubtitle')}>
      <FormError message={error} />
      <div className="ai-assistant-page">
        <aside className="ai-assistant-page__sidebar">
          <h2>{t('suggestions')}</h2>
          <div className="ai-chat-panel__prompts">
            {prompts.map((p) => (
              <button key={p} type="button" className="portal-button portal-button--ghost" onClick={() => void send(p)}>
                {p}
              </button>
            ))}
          </div>
          <p className="muted-text">{t('disclaimer')}</p>
        </aside>
        <section className="ai-assistant-page__chat">
          <div className="ai-chat-panel__messages ai-assistant-page__messages">
            {messages.length === 0 ? <p className="muted-text">{t('empty')}</p> : null}
            {messages.map((m) => (
              <div key={m.id} className={`ai-chat-msg ai-chat-msg--${m.role}`}>
                <p>{m.content}</p>
                {m.cards?.map((card, i) => {
                  if (card.tool !== 'searchMarketplaceTrucks') return null;
                  const items = (card.result as { items?: Array<{ slug: string; name: string }> })?.items ?? [];
                  return (
                    <div key={i} className="ai-chat-cards">
                      {items.slice(0, 3).map((truck) => (
                        <Link key={truck.slug} href={`/marketplace/trucks/${truck.slug}`} className="ai-chat-card">
                          {truck.name}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
            {loading ? <p className="ai-chat-typing">{t('typing')}</p> : null}
            <div ref={endRef} />
          </div>
          <form
            className="ai-chat-panel__input"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('placeholder')} />
            <button type="submit" className="portal-button portal-button--primary" disabled={loading}>{t('send')}</button>
          </form>
        </section>
      </div>
    </PortalShell>
  );
}
