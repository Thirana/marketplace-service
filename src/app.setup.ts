import {
  INestApplication,
  LoggerService,
  ValidationPipe,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppExceptionFilter } from './common/http/app-exception.filter';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import { requestIdMiddleware } from './common/http/request-id.middleware';

/**
 * Applies the shared application pipeline so runtime bootstrap and e2e tests
 * exercise the same logger, middleware, validation, and error behavior.
 */
export const configureApp = <T extends INestApplication>(app: T): T => {
  const structuredLogger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);

  app.useLogger(structuredLogger);
  app.use(requestIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new RequestLoggingInterceptor(structuredLogger));
  app.useGlobalFilters(new AppExceptionFilter(structuredLogger));
  app.enableShutdownHooks();

  return app;
};
