import {
  Get,
  Query,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../../../common/auth/admin-api-key.guard';
import { ADMIN_API_KEY_HEADER } from '../../../common/auth/admin-api-key.constants';
import { CreateProductDto } from '../dto/create-product.dto';
import { ListProductsQueryDto } from '../dto/list-products.query.dto';
import { ListProductsResponseDto } from '../dto/list-products-response.dto';
import { ProductResponseDto } from '../dto/product-response.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductsService } from '../services/products.service';

const adminApiHeader = ApiHeader({
  name: ADMIN_API_KEY_HEADER,
  required: true,
  description: 'Admin API key required for product write operations.',
});

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List active products with cursor pagination' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of products to return, capped by the API.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Opaque cursor returned by the previous page.',
  })
  @ApiOkResponse({ type: ListProductsResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid page size or malformed cursor.',
  })
  async list(
    @Query() listProductsQueryDto: ListProductsQueryDto,
  ): Promise<ListProductsResponseDto> {
    return this.productsService.list(listProductsQueryDto);
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  @adminApiHeader
  @ApiSecurity('adminApiKey')
  @ApiOperation({ summary: 'Create a product' })
  @ApiBody({ type: CreateProductDto })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid admin API key.' })
  async create(
    @Body() createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  @adminApiHeader
  @ApiSecurity('adminApiKey')
  @ApiOperation({ summary: 'Update a product' })
  @ApiBody({ type: UpdateProductDto })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid admin API key.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminApiKeyGuard)
  @adminApiHeader
  @ApiSecurity('adminApiKey')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiNoContentResponse({ description: 'Product deleted successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid admin API key.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.productsService.remove(id);
  }
}
