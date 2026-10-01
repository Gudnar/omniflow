import { Controller, Get, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { AiCatalogService } from './ai-catalog.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
@RequirePermission('ai.read')
export class AiCatalogController {
  constructor(private catalogService: AiCatalogService) {}

  @Get('providers')
  @HttpCode(200)
  listProviders() {
    return this.catalogService.listProviders();
  }

  @Get('models')
  @HttpCode(200)
  listModels() {
    return this.catalogService.listModels();
  }
}
