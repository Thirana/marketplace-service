import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { OrdersController } from './controllers/orders.controller';
import { OrderIdempotencyKey } from './entities/order-idempotency-key.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersService } from './services/orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderIdempotencyKey, Product]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
