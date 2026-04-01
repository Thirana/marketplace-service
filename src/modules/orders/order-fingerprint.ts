import { createHash } from 'node:crypto';
import { CreateOrderDto } from './dto/create-order.dto';

type CanonicalOrderFingerprintPayload = {
  customerDeviceToken: string;
  currency: 'LKR';
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

/**
 * Canonicalizes the effective order request so logically identical multi-item
 * orders produce the same fingerprint even when clients send line items in a
 * different order.
 */
const buildCanonicalOrderFingerprintPayload = (
  createOrderDto: CreateOrderDto,
): CanonicalOrderFingerprintPayload => ({
  customerDeviceToken: createOrderDto.customerDeviceToken,
  currency: 'LKR',
  items: [...createOrderDto.items]
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }))
    .sort((left, right) => left.productId.localeCompare(right.productId)),
});

/**
 * Hashes the canonical effective request payload into a fixed-width
 * fingerprint that can be stored and compared efficiently by idempotency.
 */
export const createOrderRequestFingerprint = (
  createOrderDto: CreateOrderDto,
): string =>
  createHash('sha256')
    .update(
      JSON.stringify(buildCanonicalOrderFingerprintPayload(createOrderDto)),
      'utf8',
    )
    .digest('hex');
