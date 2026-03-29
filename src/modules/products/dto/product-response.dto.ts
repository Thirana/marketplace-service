import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../entities/product.entity';

export class ProductResponseDto {
  @ApiProperty({
    example: '8c9f7e84-26b9-4d81-9e54-15e1d0f4d91f',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({ example: 'Wireless Mechanical Keyboard' })
  name!: string;

  @ApiProperty({
    example: 'Compact keyboard with hot-swappable switches.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    example: 12999,
    description: 'Price stored in minor units, for example cents.',
  })
  priceAmount!: number;

  @ApiProperty({ example: 'LKR' })
  currency!: string;

  @ApiProperty({ example: 25 })
  stockQuantity!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-03-29T04:45:22.416Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-29T04:45:22.416Z' })
  updatedAt!: string;
}

export const toProductResponseDto = (product: Product): ProductResponseDto => ({
  id: product.id,
  name: product.name,
  description: product.description,
  priceAmount: product.priceAmount,
  currency: product.currency,
  stockQuantity: product.stockQuantity,
  isActive: product.isActive,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});
