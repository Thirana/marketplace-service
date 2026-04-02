import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { Response } from 'express';
import { resolveErrorCode } from '../http/error-code.util';
import { RequestWithRequestId } from '../http/request.types';

type ErrorResponseBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  errorCode?: string;
};

/**
 * Normalizes API error responses and records structured failure logs with the
 * request context attached.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithRequestId>();
    const response = context.getResponse<Response>();
    const timestamp = new Date().toISOString();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? (exception.getResponse() as string | ErrorResponseBody)
      : undefined;
    const errorResponseBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : undefined;

    const message = Array.isArray(errorResponseBody?.message)
      ? errorResponseBody.message
      : (errorResponseBody?.message ??
        (typeof exceptionResponse === 'string'
          ? exceptionResponse
          : isHttpException
            ? exception.message
            : 'Internal server error'));

    const errorCode =
      errorResponseBody?.errorCode ??
      resolveErrorCode(statusCode, errorResponseBody?.error);

    const logPayload = {
      event: 'http.request.error',
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl || request.url,
      statusCode,
      errorCode,
      message,
      errorType: exception instanceof Error ? exception.name : 'UnknownError',
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (statusCode >= 500) {
      this.logger.error(logPayload);
    } else {
      this.logger.warn(logPayload);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      errorCode,
      requestId: request.requestId,
      timestamp,
    });
  }
}
