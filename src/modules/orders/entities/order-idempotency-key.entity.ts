import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

export enum OrderIdempotencyStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity({ name: 'order_idempotency_keys' })
export class OrderIdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'varchar', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: OrderIdempotencyStatus;

  @Column({ name: 'response_status_code', type: 'integer', default: 201 })
  responseStatusCode!: number;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;

  @OneToOne(() => Order, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
