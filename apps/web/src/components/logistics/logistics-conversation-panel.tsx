'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { FormError } from '@/components/form-error';
import {
  downloadLogisticsMessageAttachment,
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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!conversation || (!draft.trim() && !attachment)) return;
    setSending(true);
    setError(null);
    setUploadProgress(attachment ? 30 : null);
    try {
      await sendLogisticsMessage(conversation.id, draft.trim(), attachment ?? undefined);
      setDraft('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProgress(100);
      await reloadMessages(conversation.id);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }

  async function handleDownload(message: LogisticsMessage) {
    if (!message.attachmentKey) return;
    const blob = await downloadLogisticsMessageAttachment(message.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = message.attachmentOriginalName ?? 'attachment';
    a.click();
    URL.revokeObjectURL(url);
  }

  function isImage(mime?: string | null) {
    return mime?.startsWith('image/');
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
            {message.body && message.body !== '(attachment)' ? <p>{message.body}</p> : null}
            {message.attachmentKey ? (
              <div className="logistics-chat__attachment">
                {isImage(message.attachmentMimeType) ? (
                  <span>{t('messages.imageAttachment')}: {message.attachmentOriginalName}</span>
                ) : (
                  <span>{t('messages.pdfAttachment')}: {message.attachmentOriginalName}</span>
                )}
                <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void handleDownload(message)}>
                  {t('messages.downloadAttachment')}
                </button>
              </div>
            ) : null}
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
        />
        {attachment ? <p className="logistics-chat__hint">{t('messages.selectedFile', { name: attachment.name })}</p> : null}
        {uploadProgress !== null ? <progress value={uploadProgress} max={100} /> : null}
        <button type="submit" className="rental-btn rental-btn--primary" disabled={sending || (!draft.trim() && !attachment)}>
          {t('messages.send')}
        </button>
      </form>
      <p className="logistics-chat__hint">{t('messages.attachmentsHint')}</p>
    </section>
  );
}
