import { registerAs } from '@nestjs/config';

const DEFAULT_PORT = 3000;
const DEFAULT_NODE_ENV = 'development';

export const appConfig = registerAs('app', () => ({
  port: Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10),
  nodeEnv: process.env.NODE_ENV ?? DEFAULT_NODE_ENV,
}));

export type AppConfig = ReturnType<typeof appConfig>;
