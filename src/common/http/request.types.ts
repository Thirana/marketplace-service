import { Request } from 'express';

export type RequestWithRequestId = Request & {
  requestId?: string;
};
