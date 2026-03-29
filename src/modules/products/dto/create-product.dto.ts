import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    example: 'Wireless Mechanical Keyboard',
    maxLength: 255,
  })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({
    example: 'Compact keyboard with hot-swappable switches.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: 12999,
    description: 'Price stored in minor units, for example cents.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceAmount!: number;

  @ApiProperty({
    example: 'LKR',
    description:
      'Three-letter ISO currency code. The current assignment runtime assumes LKR.',
  })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @Equals('LKR')
  currency!: string;

  @ApiProperty({
    example: 25,
    description: 'Available stock quantity.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Whether the product is currently available for sale.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
