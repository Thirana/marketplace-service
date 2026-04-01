import { ApiProperty } from '@nestjs/swagger';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from '../entities/notification.entity';

const createDeviceTokenPreview = (targetDeviceToken: string): string =>
  targetDeviceToken.length <= 16
    ? targetDeviceToken
    : `${targetDeviceToken.slice(0, 8)}...${targetDeviceToken.slice(-8)}`;

export class NotificationResponseDto {
  @ApiProperty({
    example: '873938a8-8dd8-47f6-a90e-3fd8787652ea',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: '3f772c45-0dd2-4187-87ef-796922b8d147',
    format: 'uuid',
  })
  orderId!: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.ORDER_CREATED,
  })
  type!: NotificationType;

  @ApiProperty({
    enum: NotificationStatus,
    example: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @ApiProperty({
    example: 'fO2tV6x:...1L2M3N4',
    description:
      'Masked preview of the target device token used for notification delivery.',
  })
  targetDeviceTokenPreview!: string;

  @ApiProperty({ example: 'Order confirmed' })
  title!: string;

  @ApiProperty({
    example:
      'Your order 3f772c45-0dd2-4187-87ef-796922b8d147 has been created successfully.',
  })
  body!: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description:
      'Provider message identifier once Firebase delivery is integrated.',
  })
  providerMessageId!: string | null;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Failure reason once delivery attempts are recorded.',
  })
  failureReason!: string | null;

  @ApiProperty({ example: '2026-04-01T06:12:34.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-01T06:12:34.000Z' })
  updatedAt!: string;

  @ApiProperty({ example: null, nullable: true })
  sentAt!: string | null;

  @ApiProperty({ example: null, nullable: true })
  failedAt!: string | null;
}

export const toNotificationResponseDto = (
  notification: Notification,
): NotificationResponseDto => ({
  id: notification.id,
  orderId: notification.orderId,
  type: notification.type,
  status: notification.status,
  targetDeviceTokenPreview: createDeviceTokenPreview(
    notification.targetDeviceToken,
  ),
  title: notification.title,
  body: notification.body,
  providerMessageId: notification.providerMessageId,
  failureReason: notification.failureReason,
  createdAt: notification.createdAt.toISOString(),
  updatedAt: notification.updatedAt.toISOString(),
  sentAt: notification.sentAt?.toISOString() ?? null,
  failedAt: notification.failedAt?.toISOString() ?? null,
});
