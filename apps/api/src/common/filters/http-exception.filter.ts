import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ApiErrorResponse } from '@transit-logistic/shared';
import type { Request, Response } from 'express';


@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const body: ApiErrorResponse = {
      code: 'INTERNAL_ERROR',
      message_en: 'An unexpected error occurred.',
      message_ar: 'حدث خطأ غير متوقع.',
      requestId: request.headers['x-request-id'] as string | undefined,
    };

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const payload = exceptionResponse as Record<string, unknown>;
      if (typeof payload.code === 'string') body.code = payload.code;
      if (typeof payload.message_en === 'string') body.message_en = payload.message_en;
      if (typeof payload.message_ar === 'string') body.message_ar = payload.message_ar;
      if (typeof payload.message === 'string') {
        body.message_en = payload.message;
        body.message_ar = payload.message;
      }

      if (Array.isArray(payload.message) && payload.message.length > 0) {
        const combined = payload.message
          .filter((entry): entry is string => typeof entry === 'string')
          .join('; ');
        body.code = 'VALIDATION_ERROR';
        body.message_en = combined;
        body.message_ar = combined;
      }
    }

    response.status(status).json(body);
  }
}
