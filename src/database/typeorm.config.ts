import { join } from 'node:path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

export type DatabaseSettings = {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
};

/**
 * Builds the shared TypeORM connection settings used by both the Nest runtime
 * module and the standalone migration CLI datasource.
 */
export const buildDataSourceOptions = (
  database: DatabaseSettings,
): DataSourceOptions => ({
  type: 'postgres',
  host: database.host,
  port: database.port,
  username: database.username,
  password: database.password,
  database: database.name,
  entities: [join(__dirname, '../modules/**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, './migrations/*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
});

export const buildTypeOrmModuleOptions = (
  database: DatabaseSettings,
): TypeOrmModuleOptions => ({
  ...buildDataSourceOptions(database),
  autoLoadEntities: true,
  retryAttempts: 1,
  retryDelay: 0,
});
