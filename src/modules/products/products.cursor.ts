import { BadRequestException } from '@nestjs/common';

export type ProductsCursor = {
  createdAt: string;
  id: string;
};

const INVALID_PRODUCTS_CURSOR_ERROR_CODE = 'INVALID_PRODUCTS_CURSOR';

/**
 * Encodes the stable listing position into an opaque cursor so the API does
 * not expose database-specific pagination rules directly.
 */
export const encodeProductsCursor = (cursor: ProductsCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url');

/**
 * Decodes and validates the cursor supplied by clients before it is used in
 * the listing query predicate.
 */
export const decodeProductsCursor = (cursor: string): ProductsCursor => {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<ProductsCursor>;

    if (
      typeof decoded.createdAt !== 'string' ||
      Number.isNaN(Date.parse(decoded.createdAt)) ||
      typeof decoded.id !== 'string'
    ) {
      throw new Error('Cursor payload is invalid.');
    }

    return {
      createdAt: decoded.createdAt,
      id: decoded.id,
    };
  } catch {
    throw new BadRequestException({
      message: 'Invalid products cursor.',
      errorCode: INVALID_PRODUCTS_CURSOR_ERROR_CODE,
    });
  }
};
