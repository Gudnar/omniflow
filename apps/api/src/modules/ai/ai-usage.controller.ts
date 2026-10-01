import { Controller, Get, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { AiUsageService } from './ai-usage.service';

@Controller('ai/usage')
@UseGuards(JwtAuthGuard)
@RequirePermission('ai.read')
export class AiUsageController {
  constructor(private usageService: AiUsageService) {}

  @Get()
  @HttpCode(200)
  summary() {
    return this.usageService.summary();
  }
}
