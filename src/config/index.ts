export { adminConfig } from './admin.config';
export { appConfig } from './app.config';
export { databaseConfig } from './database.config';
export { firebaseConfig } from './firebase.config';
export { loggingConfig } from './logging.config';
export { validateEnv } from './env.validation';

import { adminConfig } from './admin.config';
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { firebaseConfig } from './firebase.config';
import { loggingConfig } from './logging.config';

export const configFactories = [
  appConfig,
  databaseConfig,
  loggingConfig,
  firebaseConfig,
  adminConfig,
];
