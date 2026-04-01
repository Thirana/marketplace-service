import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

const ORDER_NOT_FOUND_ERROR_CODE = 'ORDER_NOT_FOUND';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
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
}
