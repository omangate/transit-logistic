'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import {
  listLogisticsMessages,
  openLogisticsConversation,
  sendLogisticsMessage,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { LogisticsConversation, LogisticsMessage } from '@/types/logistics';

type Context = {
  logisticsOrderId?: string;
  customsRequestId?: string;
  freightRequestId?: string;
  quoteId?: string;
};

type Props = {
  context: Context;
};

export function LogisticsConversationPanel({ context }: Props) {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const [conversation, setConversation] = useState<LogisticsConversation | null>(null);
  const [messages, setMessages] = useState<LogisticsMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const reloadMessages = useCallback(async (conversationId: string) => {
    const items = await listLogisticsMessages(conversationId);
    setMessages(items);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void openLogisticsConversation(context)
      .then(async (conv) => {
        if (cancelled) return;
        setConversation(conv);
        await reloadMessages(conv.id);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [context, locale, reloadMessages, t]);

  const unreadCount = messages.filter((m) => !m.readAt).length;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!conversation || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendLogisticsMessage(conversation.id, draft.trim());
      setDraft('');
      await reloadMessages(conversation.id);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="logistics-panel logistics-chat">
      <header className="logistics-chat__header">
        <h2>{t('messages.title')}</h2>
        {unreadCount > 0 ? <span className="logistics-badge">{t('messages.unread', { count: unreadCount })}</span> : null}
      </header>
      {error ? <FormError message={error} /> : null}
      <div className="logistics-chat__thread">
        {!messages.length ? <p className="logistics-empty">{t('messages.empty')}</p> : null}
        {messages.map((message) => (
          <article key={message.id} className={`logistics-chat__message${message.readAt ? '' : ' logistics-chat__message--unread'}`}>
            <time>{new Date(message.createdAt).toLocaleString(locale)}</time>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      <form className="logistics-chat__composer" onSubmit={(e) => void handleSend(e)}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('messages.placeholder')}
          rows={3}
        />
        <button type="submit" className="rental-btn rental-btn--primary" disabled={sending || !draft.trim()}>
          {t('messages.send')}
        </button>
      </form>
      <p className="logistics-chat__hint">{t('messages.attachmentsHint')}</p>
    </section>
  );
}
