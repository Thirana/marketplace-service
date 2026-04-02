import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { RequestWithRequestId } from '../http/request.types';

/**
 * Emits one structured log per completed request, including duration and the
 * propagated request ID.
 */
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithRequestId>();
    const response = httpContext.getResponse<{ statusCode: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startedAt;
        const statusCode = response.statusCode;
        const logPayload = {
          event: 'http.request.completed',
          requestId: request.requestId,
          method: request.method,
          path: request.originalUrl || request.url,
          statusCode,
          durationMs,
        };

        if (statusCode >= 500) {
          this.logger.error(logPayload);
          return;
        }

        if (statusCode >= 400) {
          this.logger.warn(logPayload);
          return;
        }

        this.logger.log(logPayload);
      }),
    );
  }
}
