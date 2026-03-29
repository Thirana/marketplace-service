import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IdempotencyKey } from '../../../common/http/idempotency-key.decorator';
import { IDEMPOTENCY_KEY_HEADER } from '../../../common/http/idempotency-key.constants';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { OrdersService } from '../services/orders.service';

const idempotencyKeyHeader = ApiHeader({
  name: IDEMPOTENCY_KEY_HEADER,
  required: true,
  description:
    'Client-supplied key used to identify safe retries of the same order request.',
});

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @idempotencyKeyHeader
  @ApiOperation({ summary: 'Create a multi-item order' })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing Idempotency-Key header or invalid request body.',
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({
    description:
      'A requested product is unavailable, not priced in LKR, or does not have enough stock.',
  })
  async create(
    @IdempotencyKey() idempotencyKey: string,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.create(idempotencyKey, createOrderDto);
  }
}
