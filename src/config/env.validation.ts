import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;
const LOG_LEVEL_VALUES = [
  'error',
  'warn',
  'info',
  'http',
  'verbose',
  'debug',
  'silly',
] as const;

class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsIn(NODE_ENV_VALUES)
  NODE_ENV!: (typeof NODE_ENV_VALUES)[number];

  @IsString()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_NAME!: string;

  @IsIn(LOG_LEVEL_VALUES)
  LOG_LEVEL!: (typeof LOG_LEVEL_VALUES)[number];

  @IsString()
  ADMIN_API_KEY!: string;

  @IsOptional()
  @IsString()
  FIREBASE_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FIREBASE_CLIENT_EMAIL?: string;

  @IsOptional()
  @IsString()
  FIREBASE_PRIVATE_KEY?: string;
}

const hasValue = (value: unknown): boolean =>
  typeof value === 'string'
    ? value.trim().length > 0
    : value !== undefined && value !== null;

/**
 * Applies Phase 01 defaults, validates the env contract, and enforces that
 * Firebase credentials are either provided together or omitted entirely.
 */
export const validateEnv = (
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const configWithDefaults = {
    PORT: config.PORT ?? '3000',
    NODE_ENV: config.NODE_ENV ?? 'development',
    LOG_LEVEL: config.LOG_LEVEL ?? 'info',
    ...config,
  };

  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    configWithDefaults,
    {
      enableImplicitConversion: true,
    },
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  const firebaseValues = [
    validatedConfig.FIREBASE_PROJECT_ID,
    validatedConfig.FIREBASE_CLIENT_EMAIL,
    validatedConfig.FIREBASE_PRIVATE_KEY,
  ];
  const hasAnyFirebaseValue = firebaseValues.some(hasValue);
  const hasAllFirebaseValues = firebaseValues.every(hasValue);

  if (hasAnyFirebaseValue && !hasAllFirebaseValues) {
    throw new Error(
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must all be provided together.',
    );
  }

  return {
    ...validatedConfig,
    FIREBASE_PRIVATE_KEY: validatedConfig.FIREBASE_PRIVATE_KEY?.replace(
      /\\n/g,
      '\n',
    ),
  };
};
