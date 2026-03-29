import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';

export class OrderItemResponseDto {
  @ApiProperty({
    example: 'be23d9c8-cb7b-4bc7-a771-7e1d5d10b6a4',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: '8c9f7e84-26b9-4d81-9e54-15e1d0f4d91f',
    format: 'uuid',
  })
  productId!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({
    example: 12999,
    description: 'Unit price captured at the time the order was created.',
  })
  unitPriceAmount!: number;

  @ApiProperty({
    example: 25998,
    description: 'Line total stored in minor units.',
  })
  lineTotalAmount!: number;

  @ApiProperty({ example: 'LKR' })
  currency!: string;
}

export class OrderResponseDto {
  @ApiProperty({
    example: 'c38a171a-58f7-44ec-a3ba-98599156f7c7',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    type: [OrderItemResponseDto],
  })
  items!: OrderItemResponseDto[];

  @ApiProperty({
    example: 45997,
    description: 'Total order price stored in minor units.',
  })
  totalPriceAmount!: number;

  @ApiProperty({ example: 'LKR' })
  currency!: string;

  @ApiProperty({ example: '2026-03-29T04:45:22.416Z' })
  createdAt!: string;
}

const toOrderItemResponseDto = (
  orderItem: OrderItem,
): OrderItemResponseDto => ({
  id: orderItem.id,
  productId: orderItem.productId,
  quantity: orderItem.quantity,
  unitPriceAmount: orderItem.unitPriceAmount,
  lineTotalAmount: orderItem.lineTotalAmount,
  currency: orderItem.currency,
});

export const toOrderResponseDto = (order: Order): OrderResponseDto => ({
  id: order.id,
  items: order.items?.map(toOrderItemResponseDto) ?? [],
  totalPriceAmount: order.totalPriceAmount,
  currency: order.currency,
  createdAt: order.createdAt.toISOString(),
});
