import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const DEFAULT_PRODUCTS_PAGE_SIZE = 20;
export const MAX_PRODUCTS_PAGE_SIZE = 50;

export class ListProductsQueryDto {
  @ApiPropertyOptional({
    example: DEFAULT_PRODUCTS_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PRODUCTS_PAGE_SIZE,
    description: 'Maximum number of products to return in one page.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PRODUCTS_PAGE_SIZE)
  limit?: number;

  @ApiPropertyOptional({
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTAzLTI5VDA0OjQ1OjIyLjQxNloiLCJpZCI6IjhjOWY3ZTg0LTI2YjktNGQ4MS05ZTU0LTE1ZTFkMGY0ZDkxZiJ9',
    description:
      'Opaque cursor returned from the previous page to continue listing.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
