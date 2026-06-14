import type { ApiErrorResponse } from '@transit-logistic/shared';
import type { SupportedLocale } from '@transit-logistic/shared';

type NestValidationBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly message_en: string;
  readonly message_ar: string;

  constructor(code: string, message_en: string, message_ar: string) {
    super(message_en);
    this.name = 'ApiClientError';
    this.code = code;
    this.message_en = message_en;
    this.message_ar = message_ar;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message_en' in error &&
    'message_ar' in error &&
    typeof (error as ApiClientError).message_en === 'string' &&
    typeof (error as ApiClientError).message_ar === 'string'
  );
}

export function getLocalizedApiMessage(
  error: ApiClientError,
  locale: SupportedLocale,
): string {
  return locale === 'ar' ? error.message_ar : error.message_en;
}

export function createNetworkError(): ApiClientError {
  return new ApiClientError(
    'NETWORK_ERROR',
    'Unable to reach the API server. Make sure the backend is running.',
    'تعذر الوصول إلى خادم واجهة البرمجة. تأكد من تشغيل الخادم الخلفي.',
  );
}

export function createUnauthorizedError(): ApiClientError {
  return new ApiClientError(
    'UNAUTHORIZED',
    'Your session has expired. Please sign in again.',
    'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.',
  );
}

export async function parseApiError(response: Response): Promise<ApiClientError> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorResponse &
    NestValidationBody;

  if (typeof body.message_en === 'string' && typeof body.message_ar === 'string') {
    if (response.status === 401) {
      return new ApiClientError(
        body.code === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'SESSION_EXPIRED',
        body.message_en,
        body.message_ar,
      );
    }

    return new ApiClientError(
      body.code ?? 'API_ERROR',
      body.message_en,
      body.message_ar,
    );
  }

  if (Array.isArray(body.message) && body.message.length > 0) {
    const combined = body.message.join('; ');
    return new ApiClientError('VALIDATION_ERROR', combined, combined);
  }

  if (typeof body.message === 'string') {
    if (response.status === 401 || body.message === 'Unauthorized') {
      return new ApiClientError(
        'UNAUTHORIZED',
        'Your session has expired. Please sign in again.',
        'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.',
      );
    }

    return new ApiClientError('API_ERROR', body.message, body.message);
  }

  return new ApiClientError(
    'API_ERROR',
    'Request failed. Please try again.',
    'فشل الطلب. يرجى المحاولة مرة أخرى.',
  );
}
