import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { IsNull, Repository } from 'typeorm';
import { Logger } from 'winston';
import { CreateProductDto } from '../dto/create-product.dto';
import {
  ProductResponseDto,
  toProductResponseDto,
} from '../dto/product-response.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Product } from '../entities/product.entity';

const PRODUCT_NOT_FOUND_ERROR_CODE = 'PRODUCT_NOT_FOUND';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

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
