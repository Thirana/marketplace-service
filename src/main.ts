import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { appConfig } from './config';

const logger = new Logger('Bootstrap');

/**
 * Boots the Nest application after config validation and starts listening on
 * the configured port.
 */
async function bootstrap() {
  const app = configureApp(
    await NestFactory.create(AppModule, {
      bufferLogs: true,
    }),
  );
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  await app.listen(config.port);
}

/**
 * Converts bootstrap failures into a logged startup error with a non-zero exit
 * code so misconfiguration fails fast.
 */
bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown bootstrap error';
  const trace = error instanceof Error ? error.stack : String(error);

  logger.error(message, trace);
  process.exit(1);
});
