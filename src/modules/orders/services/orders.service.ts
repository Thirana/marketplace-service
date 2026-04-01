import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Logger } from 'winston';
import { Notification } from '../../notifications/entities/notification.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { Product } from '../../products/entities/product.entity';
import { CreateOrderDto, CreateOrderItemDto } from '../dto/create-order.dto';
import {
  OrderResponseDto,
  toOrderResponseDto,
} from '../dto/order-response.dto';
import {
  OrderIdempotencyKey,
  OrderIdempotencyStatus,
} from '../entities/order-idempotency-key.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { createOrderRequestFingerprint } from '../order-fingerprint';

const SUPPORTED_ORDER_CURRENCY = 'LKR';

const PRODUCT_NOT_FOUND_ERROR_CODE = 'PRODUCT_NOT_FOUND';
const PRODUCT_NOT_AVAILABLE_ERROR_CODE = 'PRODUCT_NOT_AVAILABLE';
const DUPLICATE_ORDER_PRODUCT_ERROR_CODE = 'DUPLICATE_ORDER_PRODUCT';
const INSUFFICIENT_PRODUCT_STOCK_ERROR_CODE = 'INSUFFICIENT_PRODUCT_STOCK';
const UNSUPPORTED_PRODUCT_CURRENCY_ERROR_CODE = 'UNSUPPORTED_PRODUCT_CURRENCY';
const IDEMPOTENCY_REQUEST_CONFLICT_ERROR_CODE = 'IDEMPOTENCY_REQUEST_CONFLICT';
const IDEMPOTENCY_KEY_UNIQUE_CONSTRAINT =
  'UQ_order_idempotency_keys_idempotency_key';

type PreparedOrderItemDraft = {
  product: Product;
  quantity: number;
  unitPriceAmount: number;
  lineTotalAmount: number;
};

type CreatedOrderTransactionResult = {
  order: Order;
  notification: Notification;
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  /**
   * Creates a multi-item order inside a single transaction, persists a pending
   * notification intent, and upgrades the flow with DB-backed idempotency so
   * safe retries return a stable result.
   */
  async create(
    idempotencyKey: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const requestFingerprint = createOrderRequestFingerprint(createOrderDto);

    try {
      const { order, notification } = await this.dataSource.transaction(
        async (manager): Promise<CreatedOrderTransactionResult> => {
          const idempotencyRecord = await this.createIdempotencyRecord(
            manager,
            idempotencyKey,
            requestFingerprint,
          );
          const createdOrder = await this.createNewOrder(
            manager,
            idempotencyKey,
            createOrderDto,
          );
          const createdNotification =
            await this.notificationsService.createPendingOrderCreatedNotification(
              manager,
              createdOrder,
              createOrderDto.customerDeviceToken,
            );

          idempotencyRecord.orderId = createdOrder.id;
          idempotencyRecord.status = OrderIdempotencyStatus.COMPLETED;
          await manager
            .getRepository(OrderIdempotencyKey)
            .save(idempotencyRecord);

          return {
            order: createdOrder,
            notification: createdNotification,
          };
        },
      );

      this.logger.info({
        event: 'order.created',
        orderId: order.id,
        itemsCount: order.items.length,
        totalPriceAmount: order.totalPriceAmount,
        currency: order.currency,
      });
      this.logger.info({
        event: 'notification.created',
        notificationId: notification.id,
        orderId: order.id,
        type: notification.type,
        status: notification.status,
      });

      return toOrderResponseDto(order);
    } catch (error) {
      if (!this.isIdempotencyKeyUniqueViolation(error)) {
        throw error;
      }

      return this.replayExistingOrderOrThrow(
        idempotencyKey,
        requestFingerprint,
      );
    }
  }

  /**
   * Reserves the idempotency key at the start of the transaction so duplicate
   * retries block on the unique constraint instead of creating extra orders.
   */
  private async createIdempotencyRecord(
    manager: EntityManager,
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<OrderIdempotencyKey> {
    const idempotencyRepository = manager.getRepository(OrderIdempotencyKey);

    return idempotencyRepository.save(
      idempotencyRepository.create({
        idempotencyKey,
        requestFingerprint,
        status: OrderIdempotencyStatus.IN_PROGRESS,
        responseStatusCode: 201,
        orderId: null,
      }),
    );
  }

  /**
   * Builds and persists the order aggregate once the idempotency key has been
   * reserved successfully inside the surrounding transaction.
   */
  private async createNewOrder(
    manager: EntityManager,
    idempotencyKey: string,
    createOrderDto: CreateOrderDto,
  ): Promise<Order> {
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

  /**
   * Resolves duplicate idempotency-key submissions by replaying the original
   * successful order when the fingerprint matches, or rejecting mismatches.
   */
  private async replayExistingOrderOrThrow(
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<OrderResponseDto> {
    const idempotencyRecord = await this.dataSource
      .getRepository(OrderIdempotencyKey)
      .findOneBy({ idempotencyKey });

    if (!idempotencyRecord) {
      throw new ConflictException({
        message: 'Idempotent order request could not be replayed safely.',
        errorCode: IDEMPOTENCY_REQUEST_CONFLICT_ERROR_CODE,
      });
    }

    if (idempotencyRecord.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({
        message:
          'Idempotency-Key has already been used for a different order request.',
        errorCode: IDEMPOTENCY_REQUEST_CONFLICT_ERROR_CODE,
      });
    }

    if (!idempotencyRecord.orderId) {
      throw new ConflictException({
        message: 'Idempotent order request is not ready for replay yet.',
        errorCode: IDEMPOTENCY_REQUEST_CONFLICT_ERROR_CODE,
      });
    }

    const order = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'orderItem')
      .where('order.id = :orderId', { orderId: idempotencyRecord.orderId })
      .orderBy('orderItem.created_at', 'ASC')
      .addOrderBy('orderItem.id', 'ASC')
      .getOne();

    if (!order) {
      throw new NotFoundException({
        message: `Order ${idempotencyRecord.orderId} not found for replay.`,
        errorCode: PRODUCT_NOT_FOUND_ERROR_CODE,
      });
    }

    this.logger.info({
      event: 'order.idempotent_replay',
      orderId: order.id,
      itemsCount: order.items.length,
      totalPriceAmount: order.totalPriceAmount,
      currency: order.currency,
    });

    return toOrderResponseDto(order);
  }

  private isIdempotencyKeyUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as {
      code?: string;
      constraint?: string;
    };

    return (
      driverError.code === '23505' &&
      driverError.constraint === IDEMPOTENCY_KEY_UNIQUE_CONSTRAINT
    );
  }
}
