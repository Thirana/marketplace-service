import { Controller, Get } from '@nestjs/common';
import { HealthService } from '../services/health.service';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness() {
    return this.healthService.getReadiness();
  }
}
