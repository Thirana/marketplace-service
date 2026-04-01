import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.notifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @Column({ type: 'varchar', length: 64 })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 32 })
  status!: NotificationStatus;

  @Column({ name: 'target_device_token', type: 'text' })
  targetDeviceToken!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({
    name: 'provider_message_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerMessageId!: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
