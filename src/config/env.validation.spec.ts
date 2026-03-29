import { validateEnv } from './env.validation';

const createBaseEnv = (): Record<string, string> => ({
  PORT: '3000',
  NODE_ENV: 'development',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres-username',
  DB_PASSWORD: 'postgres-test-password',
  DB_NAME: 'marketplace_service',
  LOG_LEVEL: 'info',
  ADMIN_API_KEY: 'test-admin-key',
});

describe('validateEnv', () => {
  it('accepts a valid minimal configuration', () => {
    expect(validateEnv(createBaseEnv())).toMatchObject({
      PORT: 3000,
      DB_PORT: 5432,
      ADMIN_API_KEY: 'test-admin-key',
    });
  });

  it('fails when a required database field is missing', () => {
    const invalidEnv = createBaseEnv();
    delete invalidEnv.DB_HOST;

    expect(() => validateEnv(invalidEnv)).toThrow();
  });

  it('fails when the admin api key is missing', () => {
    const invalidEnv = createBaseEnv();
    delete invalidEnv.ADMIN_API_KEY;

    expect(() => validateEnv(invalidEnv)).toThrow();
  });

  it('fails when port values are not numeric', () => {
    expect(() =>
      validateEnv({
        ...createBaseEnv(),
        PORT: 'not-a-number',
      }),
    ).toThrow();

    expect(() =>
      validateEnv({
        ...createBaseEnv(),
        DB_PORT: 'not-a-number',
      }),
    ).toThrow();
  });

  it('allows firebase credentials to be absent', () => {
    expect(validateEnv(createBaseEnv()).FIREBASE_PROJECT_ID).toBeUndefined();
  });

  it('fails when firebase credentials are partially provided', () => {
    expect(() =>
      validateEnv({
        ...createBaseEnv(),
        FIREBASE_PROJECT_ID: 'project-id',
      }),
    ).toThrow(
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must all be provided together.',
    );
  });

  it('accepts a full firebase configuration and normalizes the private key', () => {
    expect(
      validateEnv({
        ...createBaseEnv(),
        FIREBASE_PROJECT_ID: 'project-id',
        FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
        FIREBASE_PRIVATE_KEY:
          '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      }),
    ).toMatchObject({
      FIREBASE_PROJECT_ID: 'project-id',
      FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
      FIREBASE_PRIVATE_KEY:
        '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    });
  });
});
