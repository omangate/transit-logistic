'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Link } from '@/i18n/navigation';
import { sendAiChat } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { getAccessToken } from '@/lib/auth-storage';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: Array<{ tool: string; result: unknown }>;
};

const PROMPTS_AR = [
  'ابحث لي عن شاحنة',
  'أريد نقل بضاعة',
  'أي نوع شاحنة يناسب حمولتي؟',
  'تابع طلب عرض السعر',
  'أين شحنتي؟',
  'ساعدني في إضافة شاحنة',
];

const PROMPTS_EN = [
  'Find me a truck',
  'I need to move cargo',
  'Which truck fits my load?',
  'Track my quote request',
  'Where is my shipment?',
  'Help me list a truck',
];

export function AiChatWidget() {
  const t = useTranslations('ai');
  const locale = useLocale() as 'en' | 'ar';
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [authed, setAuthed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuthed(Boolean(getAccessToken()));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  if (!authed) return null;

  const prompts = locale === 'ar' ? PROMPTS_AR : PROMPTS_EN;

  const send = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
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
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('error'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="ai-chat-fab" onClick={() => setOpen((v) => !v)} aria-label={t('title')}>
        ✦
      </button>

      {open ? (
        <div className={`ai-chat-panel${locale === 'ar' ? ' ai-chat-panel--rtl' : ''}`}>
          <header className="ai-chat-panel__header">
            <strong>{t('title')}</strong>
            <button type="button" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="ai-chat-panel__prompts">
            {prompts.map((p) => (
              <button key={p} type="button" onClick={() => void send(p)}>
                {p}
              </button>
            ))}
          </div>

          <div className="ai-chat-panel__messages">
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
            <button type="submit" disabled={loading}>{t('send')}</button>
          </form>
        </div>
      ) : null}
    </>
  );
}
