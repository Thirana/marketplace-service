import { createOrderRequestFingerprint } from './order-fingerprint';

describe('createOrderRequestFingerprint', () => {
  it('returns the same fingerprint for the same basket in a different item order', () => {
    const firstFingerprint = createOrderRequestFingerprint({
      items: [
        {
          productId: 'c0000000-0000-4000-8000-000000000003',
          quantity: 3,
        },
        {
          productId: 'a0000000-0000-4000-8000-000000000001',
          quantity: 1,
        },
      ],
    });
    const secondFingerprint = createOrderRequestFingerprint({
      items: [
        {
          productId: 'a0000000-0000-4000-8000-000000000001',
          quantity: 1,
        },
        {
          productId: 'c0000000-0000-4000-8000-000000000003',
          quantity: 3,
        },
      ],
    });

    expect(firstFingerprint).toBe(secondFingerprint);
  });

  it('returns a different fingerprint when the basket contents change', () => {
    const originalFingerprint = createOrderRequestFingerprint({
      items: [
        {
          productId: 'a0000000-0000-4000-8000-000000000001',
          quantity: 1,
        },
      ],
    });
    const changedFingerprint = createOrderRequestFingerprint({
      items: [
        {
          productId: 'a0000000-0000-4000-8000-000000000001',
          quantity: 2,
        },
      ],
    });

    expect(originalFingerprint).not.toBe(changedFingerprint);
  });
});
