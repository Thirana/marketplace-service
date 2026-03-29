export type ErrorResponseBody = {
  statusCode: number;
  errorCode: string;
  requestId: string;
  timestamp: string;
};

/**
 * Narrows the generic supertest body into the standardized API error shape so
 * e2e assertions remain type-safe and document the contract under test.
 */
export const parseErrorResponseBody = (body: unknown): ErrorResponseBody => {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected an object error response body.');
  }

  const { statusCode, errorCode, requestId, timestamp } = body as Record<
    string,
    unknown
  >;

  if (
    typeof statusCode !== 'number' ||
    typeof errorCode !== 'string' ||
    typeof requestId !== 'string' ||
    typeof timestamp !== 'string'
  ) {
    throw new Error('Error response body is missing required fields.');
  }

  return {
    statusCode,
    errorCode,
    requestId,
    timestamp,
  };
};
