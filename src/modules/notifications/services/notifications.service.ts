import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { EntityManager, Repository } from 'typeorm';
import { Logger } from 'winston';
import { Order } from '../../orders/entities/order.entity';
import {
  NotificationResponseDto,
  toNotificationResponseDto,
} from '../dto/notification-response.dto';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from '../entities/notification.entity';
import { FirebaseNotificationGatewayService } from './firebase-notification-gateway.service';

const ORDER_NOT_FOUND_ERROR_CODE = 'ORDER_NOT_FOUND';
const UNKNOWN_NOTIFICATION_DELIVERY_FAILURE =
  'Unknown notification delivery failure.';
const MAX_NOTIFICATION_FAILURE_REASON_LENGTH = 500;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly firebaseNotificationGateway: FirebaseNotificationGatewayService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  /**
   * Creates a persisted pending notification intent inside the surrounding
   * order transaction so later delivery work has an explicit DB-backed target.
   */
  async createPendingOrderCreatedNotification(
    manager: EntityManager,
    order: Order,
    customerDeviceToken: string,
  ): Promise<Notification> {
    const notificationRepository = manager.getRepository(Notification);
    const { title, body } = this.buildOrderCreatedNotificationContent(order);

    return notificationRepository.save(
      notificationRepository.create({
        orderId: order.id,
        type: NotificationType.ORDER_CREATED,
        status: NotificationStatus.PENDING,
        targetDeviceToken: customerDeviceToken,
        title,
        body,
        providerMessageId: null,
        failureReason: null,
        sentAt: null,
        failedAt: null,
      }),
    );
  }

  /**
   * Schedules notification delivery after the order transaction commits so
   * push delivery latency or provider failures never block order success.
   */
  scheduleDelivery(notificationId: string): void {
    setImmediate(() => {
      void this.deliverPendingNotification(notificationId).catch((error) => {
        this.logger.error({
          event: 'notification.delivery_unhandled_failure',
          notificationId,
          failureReason: this.buildFailureReason(error),
        });
      });
    });
  }

  /**
   * Loads a pending notification, attempts Firebase delivery from the persisted
   * intent, and records the terminal status transition in the database.
   */
  async deliverPendingNotification(notificationId: string): Promise<void> {
    const notification = await this.notificationsRepository.findOneBy({
      id: notificationId,
    });

    if (!notification) {
      this.logger.warn({
        event: 'notification.delivery_skipped',
        notificationId,
        reason: 'Notification not found.',
      });
      return;
    }

    if (notification.status !== NotificationStatus.PENDING) {
      return;
    }

    try {
      const providerMessageId =
        await this.firebaseNotificationGateway.send(notification);
      await this.markAsSent(notification, providerMessageId);
    } catch (error) {
      await this.markAsFailed(notification, error);
    }
  }

  /**
   * Returns the persisted notifications for an order after confirming the
   * parent order exists so the API can distinguish empty results from 404s.
   */
  async listByOrderId(orderId: string): Promise<NotificationResponseDto[]> {
    const orderExists = await this.ordersRepository.existsBy({ id: orderId });

    if (!orderExists) {
      throw new NotFoundException({
        message: `Order ${orderId} not found.`,
        errorCode: ORDER_NOT_FOUND_ERROR_CODE,
      });
    }

    const notifications = await this.notificationsRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    return notifications.map(toNotificationResponseDto);
  }

  /**
   * Builds a simple deterministic notification payload for newly created
   * orders so the persisted intent is immediately useful and reviewable.
   */
  private buildOrderCreatedNotificationContent(
    order: Order,
  ): Pick<Notification, 'title' | 'body'> {
    return {
      title: 'Order confirmed',
      body: `Your order ${order.id} has been created successfully.`,
    };
  }

  /**
   * Persists a successful provider handoff so the notification lifecycle is
   * observable through both the database and the admin read API.
   */
  private async markAsSent(
    notification: Notification,
    providerMessageId: string,
  ): Promise<void> {
    notification.status = NotificationStatus.SENT;
    notification.providerMessageId = providerMessageId;
    notification.failureReason = null;
    notification.sentAt = new Date();
    notification.failedAt = null;

    await this.notificationsRepository.save(notification);

    this.logger.info({
      event: 'notification.sent',
      notificationId: notification.id,
      orderId: notification.orderId,
      type: notification.type,
      providerMessageId,
    });
  }

  /**
   * Records provider or configuration failures without rethrowing them into the
   * order path so delivery remains observable but non-blocking.
   */
  private async markAsFailed(
    notification: Notification,
    error: unknown,
  ): Promise<void> {
    const failureReason = this.buildFailureReason(error);

    notification.status = NotificationStatus.FAILED;
    notification.providerMessageId = null;
    notification.failureReason = failureReason;
    notification.sentAt = null;
    notification.failedAt = new Date();

    await this.notificationsRepository.save(notification);

    this.logger.error({
      event: 'notification.failed',
      notificationId: notification.id,
      orderId: notification.orderId,
      type: notification.type,
      failureReason,
    });
  }

  /**
   * Produces a concise persisted/logged failure reason that is useful for
   * debugging without depending on provider-specific stack traces.
   */
  private buildFailureReason(error: unknown): string {
    if (error instanceof Error) {
      const errorCode =
        'code' in error && typeof error.code === 'string'
          ? error.code
          : undefined;
      const errorMessage =
        error.message || UNKNOWN_NOTIFICATION_DELIVERY_FAILURE;
      const failureReason = errorCode
        ? `${errorCode}: ${errorMessage}`
        : errorMessage;

      return failureReason.slice(0, MAX_NOTIFICATION_FAILURE_REASON_LENGTH);
    }

    return UNKNOWN_NOTIFICATION_DELIVERY_FAILURE;
  }
}
