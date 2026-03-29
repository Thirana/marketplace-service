import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { IsNull, Repository } from 'typeorm';
import { Logger } from 'winston';
import { CreateProductDto } from '../dto/create-product.dto';
import {
  DEFAULT_PRODUCTS_PAGE_SIZE,
  ListProductsQueryDto,
} from '../dto/list-products.query.dto';
import { ListProductsResponseDto } from '../dto/list-products-response.dto';
import {
  ProductResponseDto,
  toProductResponseDto,
} from '../dto/product-response.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Product } from '../entities/product.entity';
import { decodeProductsCursor, encodeProductsCursor } from '../products.cursor';

const PRODUCT_NOT_FOUND_ERROR_CODE = 'PRODUCT_NOT_FOUND';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  /**
   * Returns the public catalog view using a stable cursor over active,
   * non-deleted products so continuation stays deterministic across pages.
   */
  async list(
    listProductsQueryDto: ListProductsQueryDto,
  ): Promise<ListProductsResponseDto> {
    const limit = listProductsQueryDto.limit ?? DEFAULT_PRODUCTS_PAGE_SIZE;
    const cursor = listProductsQueryDto.cursor
      ? decodeProductsCursor(listProductsQueryDto.cursor)
      : null;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .where('product.deleted_at IS NULL')
      .andWhere('product.is_active = :isActive', { isActive: true })
      .orderBy('product.created_at', 'DESC')
      .addOrderBy('product.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      queryBuilder.andWhere(
        '(product.created_at < :cursorCreatedAt OR (product.created_at = :cursorCreatedAt AND product.id < :cursorId))',
        {
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id,
        },
      );
    }

    const products = await queryBuilder.getMany();
    const hasNextPage = products.length > limit;
    const items = hasNextPage ? products.slice(0, limit) : products;
    const lastItem = items.at(-1);

    return {
      items: items.map(toProductResponseDto),
      pageInfo: {
        limit,
        hasNextPage,
        nextCursor:
          hasNextPage && lastItem
            ? encodeProductsCursor({
                createdAt: lastItem.createdAt.toISOString(),
                id: lastItem.id,
              })
            : null,
      },
    };
  }

  /**
   * Persists a new product using explicit defaults for optional fields and
   * emits a structured domain log for downstream operational visibility.
   */
  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const product = this.productsRepository.create({
      ...createProductDto,
      description: createProductDto.description ?? null,
      isActive: createProductDto.isActive ?? true,
    });
    const savedProduct = await this.productsRepository.save(product);

    this.logger.info({
      event: 'product.created',
      productId: savedProduct.id,
      currency: savedProduct.currency,
      priceAmount: savedProduct.priceAmount,
    });

    return toProductResponseDto(savedProduct);
  }

  /**
   * Applies admin-supplied changes to an existing product while preserving the
   * not-found guardrail for deleted catalog entries.
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.findActiveProductOrThrow(id);
    const updatedProduct = await this.productsRepository.save(
      this.productsRepository.merge(product, updateProductDto),
    );

    this.logger.info({
      event: 'product.updated',
      productId: updatedProduct.id,
      changedFields: Object.keys(updateProductDto),
    });

    return toProductResponseDto(updatedProduct);
  }

  /**
   * Soft-deletes a product so it disappears from public and admin mutation
   * flows without immediately erasing row history needed by later phases.
   */
  async remove(id: string): Promise<void> {
    const product = await this.findActiveProductOrThrow(id);

    await this.productsRepository.softRemove(product);

    this.logger.info({
      event: 'product.deleted',
      productId: product.id,
    });
  }

  /**
   * Loads only products that are still active in the catalog lifecycle so
   * update and delete operations cannot mutate already deleted rows.
   */
  private async findActiveProductOrThrow(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    if (!product) {
      throw new NotFoundException({
        message: `Product ${id} not found.`,
        errorCode: PRODUCT_NOT_FOUND_ERROR_CODE,
      });
    }

    return product;
  }
}
