const toScreamingSnakeCase = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

export const resolveErrorCode = (
  statusCode: number,
  errorName?: string,
): string => {
  if (errorName && errorName.trim().length > 0) {
    return toScreamingSnakeCase(errorName);
  }

  if (statusCode >= 500) {
    return 'INTERNAL_SERVER_ERROR';
  }

  return `HTTP_${statusCode}`;
};
