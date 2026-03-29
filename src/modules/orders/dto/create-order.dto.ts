import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({
    example: '8c9f7e84-26b9-4d81-9e54-15e1d0f4d91f',
    format: 'uuid',
    description: 'Identifier of the product being ordered.',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    example: 2,
    minimum: 1,
    description: 'Number of product units to purchase for this line item.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({
    type: [CreateOrderItemDto],
    description: 'Basket items to include in the order.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
