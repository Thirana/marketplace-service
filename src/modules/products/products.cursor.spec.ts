import { BadRequestException } from '@nestjs/common';
import { decodeProductsCursor, encodeProductsCursor } from './products.cursor';

describe('products cursor helpers', () => {
  it('round-trips a valid cursor payload', () => {
    const encoded = encodeProductsCursor({
      createdAt: '2026-03-29T04:45:22.416Z',
      id: '8c9f7e84-26b9-4d81-9e54-15e1d0f4d91f',
    });

    expect(decodeProductsCursor(encoded)).toEqual({
      createdAt: '2026-03-29T04:45:22.416Z',
      id: '8c9f7e84-26b9-4d81-9e54-15e1d0f4d91f',
    });
  });

  it('rejects an invalid cursor payload', () => {
    expect(() => decodeProductsCursor('not-a-valid-cursor')).toThrow(
      BadRequestException,
    );
  });
});
