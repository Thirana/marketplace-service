import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminApiKeyGuard } from '../../common/auth/admin-api-key.guard';
import { Order } from '../orders/entities/order.entity';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Order])],
  controllers: [NotificationsController],
  providers: [NotificationsService, AdminApiKeyGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
