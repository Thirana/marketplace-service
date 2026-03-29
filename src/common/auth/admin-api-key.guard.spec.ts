import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { adminConfig } from '../../config';
import { ADMIN_API_KEY_HEADER } from './admin-api-key.constants';
import { AdminApiKeyGuard } from './admin-api-key.guard';

const createExecutionContext = (apiKey: string | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name === ADMIN_API_KEY_HEADER ? apiKey : undefined,
      }),
    }),
  }) as ExecutionContext;

describe('AdminApiKeyGuard', () => {
  const configuredAdmin = {
    apiKey: 'test-admin-key',
  } as ReturnType<typeof adminConfig>;

  it('allows requests with the configured admin API key', () => {
    const guard = new AdminApiKeyGuard(configuredAdmin);

    expect(guard.canActivate(createExecutionContext('test-admin-key'))).toBe(
      true,
    );
  });

  it('rejects requests with a missing admin API key', () => {
    const guard = new AdminApiKeyGuard(configuredAdmin);

    expect(() => guard.canActivate(createExecutionContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects requests with an invalid admin API key', () => {
    const guard = new AdminApiKeyGuard(configuredAdmin);

    expect(() =>
      guard.canActivate(createExecutionContext('wrong-key')),
    ).toThrow(UnauthorizedException);
  });
});
