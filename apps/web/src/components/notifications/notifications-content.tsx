'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { PortalShell } from '../portal/portal-shell';

import { useRequireAuth } from '@/hooks/use-require-auth';
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate } from '@/lib/shipment-utils';
import type { Notification } from '@/types/notification';

export function NotificationsContent() {
  const t = useTranslations('notifications');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);

  async function loadNotifications() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listNotifications({ page: 1, limit: 50 });
      setNotifications(response.data);
    } catch (loadError) {
      setError(
        isApiClientError(loadError)
          ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
          : tPortal('errors.generic'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    void loadNotifications();
  }, [isReady, user, locale, tPortal]);

  async function handleMarkRead(notificationId: string) {
    setIsActionPending(true);
    setError(null);

    try {
      await markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification,
        ),
      );
    } catch (actionError) {
      setError(
        isApiClientError(actionError)
          ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
          : tPortal('errors.generic'),
      );
    } finally {
      setIsActionPending(false);
    }
  }

  async function handleMarkAllRead() {
    setIsActionPending(true);
    setError(null);

    try {
      await markAllNotificationsAsRead();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
      );
    } catch (actionError) {
      setError(
        isApiClientError(actionError)
          ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
          : tPortal('errors.generic'),
      );
    } finally {
      setIsActionPending(false);
    }
  }

  if (!isReady || !user) {
    return <LoadingState message={tPortal('loading')} />;
  }

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <PortalShell
      user={user}
      title={t('title')}
      subtitle={t('subtitle')}
      action={
        unreadCount > 0 ? (
          <button
            type="button"
            className="portal-button portal-button--ghost"
            disabled={isActionPending}
            onClick={() => void handleMarkAllRead()}
          >
            {isActionPending ? t('working') : t('markAllRead')}
          </button>
        ) : null
      }
    >
      <FormError message={error} />

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : notifications.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <ul className="notification-list">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`notification-list__item${notification.isRead ? '' : ' notification-list__item--unread'}`}
            >
              <div className="notification-list__content">
                <h3 className="notification-list__title">{notification.title}</h3>
                <p className="notification-list__body">{notification.body}</p>
                <span className="notification-list__date">
                  {formatDate(notification.createdAt, locale)}
                </span>
              </div>
              {!notification.isRead ? (
                <button
                  type="button"
                  className="portal-button portal-button--ghost"
                  disabled={isActionPending}
                  onClick={() => void handleMarkRead(notification.id)}
                >
                  {t('markRead')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PortalShell>
  );
}
