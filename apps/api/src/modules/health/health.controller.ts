import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthCheckResponse } from '@omniflow/types';

@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthCheckResponse> {
    return this.healthService.check();
  }
}
