import type { SupportedLocale } from '../constants/locales';

export interface ApiErrorResponse {
  code: string;
  message_en: string;
  message_ar: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BilingualText {
  en: string;
  ar: string;
}

export interface UserPreferences {
  locale: SupportedLocale;
}
