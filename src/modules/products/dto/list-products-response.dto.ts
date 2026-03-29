import { ApiProperty } from '@nestjs/swagger';
import { ProductResponseDto } from './product-response.dto';

export class ProductsPageInfoDto {
  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTAzLTI5VDA0OjQ1OjIyLjQxNloiLCJpZCI6IjhjOWY3ZTg0LTI2YjktNGQ4MS05ZTU0LTE1ZTFkMGY0ZDkxZiJ9',
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;
}

export class ListProductsResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: ProductResponseDto[];

  @ApiProperty({ type: ProductsPageInfoDto })
  pageInfo!: ProductsPageInfoDto;
}
