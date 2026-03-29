import { randomUUID } from 'node:crypto';

import { NextFunction, Response } from 'express';
import { REQUEST_ID_HEADER } from './request-id.constants';
import { RequestWithRequestId } from './request.types';

/**
 * Preserves an incoming request ID when present, otherwise generates one and
 * exposes it to downstream handlers and clients.
 */
export const requestIdMiddleware = (
  request: RequestWithRequestId,
  response: Response,
  next: NextFunction,
): void => {
  const incomingRequestId = request.header(REQUEST_ID_HEADER);
  const requestId = incomingRequestId || randomUUID();

  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};
