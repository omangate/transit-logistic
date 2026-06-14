export interface Notification {
  id: string;
  channel: string;
  title: string;
  body: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  data: unknown;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: Notification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface UnreadNotificationsCount {
  unreadCount: number;
}
