import 'dotenv/config';
import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { validateEnv } from '../config';
import { buildDataSourceOptions, DatabaseSettings } from './typeorm.config';

const validatedEnv = validateEnv({ ...process.env });

const databaseSettings: DatabaseSettings = {
  host: String(validatedEnv.DB_HOST),
  port: Number(validatedEnv.DB_PORT),
  username: String(validatedEnv.DB_USERNAME),
  password: String(validatedEnv.DB_PASSWORD),
  name: String(validatedEnv.DB_NAME),
};

export default new DataSource(buildDataSourceOptions(databaseSettings));
