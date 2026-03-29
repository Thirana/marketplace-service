import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CreateOrderDto, CreateOrderItemDto } from '../dto/create-order.dto';
import {
  OrderResponseDto,
  toOrderResponseDto,
} from '../dto/order-response.dto';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../../products/entities/product.entity';

const SUPPORTED_ORDER_CURRENCY = 'LKR';

const PRODUCT_NOT_FOUND_ERROR_CODE = 'PRODUCT_NOT_FOUND';
const PRODUCT_NOT_AVAILABLE_ERROR_CODE = 'PRODUCT_NOT_AVAILABLE';
const DUPLICATE_ORDER_PRODUCT_ERROR_CODE = 'DUPLICATE_ORDER_PRODUCT';
const INSUFFICIENT_PRODUCT_STOCK_ERROR_CODE = 'INSUFFICIENT_PRODUCT_STOCK';
const UNSUPPORTED_PRODUCT_CURRENCY_ERROR_CODE = 'UNSUPPORTED_PRODUCT_CURRENCY';

type PreparedOrderItemDraft = {
  product: Product;
  quantity: number;
  unitPriceAmount: number;
  lineTotalAmount: number;
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a multi-item order inside a single transaction so basket
   * validation, stock deduction, and persisted totals remain consistent.
   */
  async create(
    idempotencyKey: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.dataSource.transaction(async (manager) => {
      this.assertUniqueOrderItems(createOrderDto.items);

      const productsById = await this.loadProductsForOrderingOrThrow(
        manager,
        createOrderDto.items,
      );
      const preparedOrderItems = this.prepareOrderItems(
        createOrderDto.items,
        productsById,
      );

      const totalPriceAmount = preparedOrderItems.reduce(
        (sum, orderItem) => sum + orderItem.lineTotalAmount,
        0,
      );

      const savedOrder = await manager.getRepository(Order).save(
        manager.getRepository(Order).create({
          idempotencyKey,
          totalPriceAmount,
          currency: SUPPORTED_ORDER_CURRENCY,
        }),
      );

      const productsRepository = manager.getRepository(Product);
      const orderItemsRepository = manager.getRepository(OrderItem);

      for (const orderItem of preparedOrderItems) {
        await productsRepository.save(orderItem.product);
      }

      const savedOrderItems: OrderItem[] = [];

      for (const orderItem of preparedOrderItems) {
        savedOrderItems.push(
          await orderItemsRepository.save(
            orderItemsRepository.create({
              orderId: savedOrder.id,
              productId: orderItem.product.id,
              quantity: orderItem.quantity,
              unitPriceAmount: orderItem.unitPriceAmount,
              lineTotalAmount: orderItem.lineTotalAmount,
              currency: SUPPORTED_ORDER_CURRENCY,
            }),
          ),
        );
      }

      return Object.assign(savedOrder, {
        items: savedOrderItems,
      });
    });

    return toOrderResponseDto(order);
  }

  /**
   * Rejects baskets that repeat the same product because inventory checks and
   * idempotency fingerprinting should operate on a normalized item list.
   */
  private assertUniqueOrderItems(orderItems: CreateOrderItemDto[]): void {
    const seenProductIds = new Set<string>();

    for (const orderItem of orderItems) {
      if (seenProductIds.has(orderItem.productId)) {
        throw new BadRequestException({
          message: `Product ${orderItem.productId} appears more than once in the order basket.`,
          errorCode: DUPLICATE_ORDER_PRODUCT_ERROR_CODE,
        });
      }

      seenProductIds.add(orderItem.productId);
    }
  }

  /**
   * Loads and pessimistically locks the requested product rows in sorted ID
   * order so concurrent multi-item checkouts reduce deadlock and oversell risk.
   */
  private async loadProductsForOrderingOrThrow(
    manager: EntityManager,
    orderItems: CreateOrderItemDto[],
  ): Promise<Map<string, Product>> {
    const productIds = orderItems
      .map((orderItem) => orderItem.productId)
      .sort((left, right) => left.localeCompare(right));

    const products = await manager
      .getRepository(Product)
      .createQueryBuilder('product')
      .setLock('pessimistic_write')
      .where('product.id IN (:...productIds)', { productIds })
      .andWhere('product.deleted_at IS NULL')
      .orderBy('product.id', 'ASC')
      .getMany();

    const productsById = new Map(
      products.map((product) => [product.id, product] as const),
    );
    const missingProductId = productIds.find(
      (productId) => !productsById.has(productId),
    );

    if (missingProductId) {
      throw new NotFoundException({
        message: `Product ${missingProductId} not found.`,
        errorCode: PRODUCT_NOT_FOUND_ERROR_CODE,
      });
    }

    return productsById;
  }

  /**
   * Validates each requested line item against the locked product state,
   * applies stock deductions, and returns the persisted pricing snapshot draft.
   */
  private prepareOrderItems(
    orderItems: CreateOrderItemDto[],
    productsById: Map<string, Product>,
  ): PreparedOrderItemDraft[] {
    return orderItems.map((orderItem) => {
      const product = productsById.get(orderItem.productId);

      if (!product) {
        throw new NotFoundException({
          message: `Product ${orderItem.productId} not found.`,
          errorCode: PRODUCT_NOT_FOUND_ERROR_CODE,
        });
      }

      if (!product.isActive) {
        throw new ConflictException({
          message: `Product ${orderItem.productId} is not available for ordering.`,
          errorCode: PRODUCT_NOT_AVAILABLE_ERROR_CODE,
        });
      }

      if (product.currency !== SUPPORTED_ORDER_CURRENCY) {
        throw new ConflictException({
          message: `Product ${orderItem.productId} is not priced in ${SUPPORTED_ORDER_CURRENCY}.`,
          errorCode: UNSUPPORTED_PRODUCT_CURRENCY_ERROR_CODE,
        });
      }

      if (product.stockQuantity < orderItem.quantity) {
        throw new ConflictException({
          message: `Requested quantity exceeds available product stock for ${orderItem.productId}.`,
          errorCode: INSUFFICIENT_PRODUCT_STOCK_ERROR_CODE,
        });
      }

      product.stockQuantity -= orderItem.quantity;

      return {
        product,
        quantity: orderItem.quantity,
        unitPriceAmount: product.priceAmount,
        lineTotalAmount: product.priceAmount * orderItem.quantity,
      };
    });
  }
}
