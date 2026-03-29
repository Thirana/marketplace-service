import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';
import { adminConfig } from '../../config';
import {
  ADMIN_API_KEY_HEADER,
  INVALID_ADMIN_API_KEY_ERROR_CODE,
} from './admin-api-key.constants';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(
    @Inject(adminConfig.KEY)
    private readonly admin: ConfigType<typeof adminConfig>,
  ) {}

  /**
   * Authorizes admin product write routes using the configured header-based API
   * key without ever logging or echoing the provided key value.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedApiKey = request.header(ADMIN_API_KEY_HEADER);

    if (!providedApiKey || providedApiKey !== this.admin.apiKey) {
      throw new UnauthorizedException({
        message: 'Invalid admin API key.',
        errorCode: INVALID_ADMIN_API_KEY_ERROR_CODE,
      });
    }

    return true;
  }
}
