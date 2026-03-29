import { registerAs } from '@nestjs/config';
import { DatabaseSettings } from '../database/typeorm.config';

export const databaseConfig = registerAs(
  'database',
  (): DatabaseSettings => ({
    host: process.env.DB_HOST ?? '',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? '',
  }),
);

export type DatabaseConfig = ReturnType<typeof databaseConfig>;
