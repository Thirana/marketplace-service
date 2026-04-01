import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../../../common/auth/admin-api-key.guard';
import { ADMIN_API_KEY_HEADER } from '../../../common/auth/admin-api-key.constants';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { NotificationsService } from '../services/notifications.service';

const adminApiHeader = ApiHeader({
  name: ADMIN_API_KEY_HEADER,
  required: true,
  description: 'Admin API key required for notification read operations.',
});

@ApiTags('notifications')
@Controller('orders/:orderId/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(AdminApiKeyGuard)
  @adminApiHeader
  @ApiSecurity('adminApiKey')
  @ApiOperation({ summary: 'List persisted notifications for an order' })
  @ApiParam({
    name: 'orderId',
    type: String,
    description:
      'Identifier of the order whose notifications should be returned.',
  })
  @ApiOkResponse({ type: NotificationResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid admin API key.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  async listByOrderId(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ): Promise<NotificationResponseDto[]> {
    return this.notificationsService.listByOrderId(orderId);
  }
}
