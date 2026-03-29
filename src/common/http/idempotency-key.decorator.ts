import { BadRequestException, createParamDecorator } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { Request } from 'express';
import {
  IDEMPOTENCY_KEY_HEADER,
  INVALID_IDEMPOTENCY_KEY_ERROR_CODE,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MISSING_IDEMPOTENCY_KEY_ERROR_CODE,
} from './idempotency-key.constants';

/**
 * Extracts and validates the Idempotency-Key header so order handlers receive
 * a normalized value that is safe to persist and compare in later phases.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.header(IDEMPOTENCY_KEY_HEADER)?.trim();

    if (!idempotencyKey) {
      throw new BadRequestException({
        message: 'Idempotency-Key header is required.',
        errorCode: MISSING_IDEMPOTENCY_KEY_ERROR_CODE,
      });
    }

    if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException({
        message: `Idempotency-Key header must be ${MAX_IDEMPOTENCY_KEY_LENGTH} characters or fewer.`,
        errorCode: INVALID_IDEMPOTENCY_KEY_ERROR_CODE,
      });
    }

    return idempotencyKey;
  },
);
