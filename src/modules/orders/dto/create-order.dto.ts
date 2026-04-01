import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
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
    example:
      'fO2tV6x:APA91bGf9x9R4Xn4r3Qw5YpY1x3pM7j8K2l5z9A1b2C3d4E5f6G7h8I9j0K1L2M3N4',
    description:
      'FCM registration token identifying the client device that should receive the order notification.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'customerDeviceToken should not be empty',
  })
  customerDeviceToken!: string;

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
