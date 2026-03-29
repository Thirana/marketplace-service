import { registerAs } from '@nestjs/config';

const DEFAULT_LOG_LEVEL = 'info';

export const loggingConfig = registerAs('logging', () => ({
  level: process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
}));

export type LoggingConfig = ReturnType<typeof loggingConfig>;
