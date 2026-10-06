import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { AiCatalogService } from './ai-catalog.service';
import { AiCredentialsService } from './ai-credentials.service';
import { UpsertAiCredentialDto, TestAiCredentialDto } from './dto/ai-credential.dto';
import { ALL_TOOLS } from './tools/registry';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiCatalogController {
  constructor(
    private catalogService: AiCatalogService,
    private credentialsService: AiCredentialsService,
  ) {}

  // Phase 14: AI Commerce — static metadata (name/description/riskLevel),
  // never per-tenant, so the agent form can render the full tool picker
  // without duplicating the registry on the frontend.
  @Get('tools')
  @RequirePermission('ai.read')
  @HttpCode(200)
  listTools() {
    return ALL_TOOLS.map(({ name, description, riskLevel }) => ({ name, description, riskLevel }));
  }

  @Get('providers')
  @RequirePermission('ai.read')
  @HttpCode(200)
  listProviders(@Request() req: any) {
    return this.catalogService.listProviders(req.user.tenantId);
  }

  @Get('models')
  @RequirePermission('ai.read')
  @HttpCode(200)
  listModels(@Request() req: any) {
    return this.catalogService.listModels(req.user.tenantId);
  }

  @Post('providers/:providerId/credential')
  @RequirePermission('ai.manage')
  upsertCredential(@Request() req: any, @Param('providerId') providerId: string, @Body() dto: UpsertAiCredentialDto) {
    return this.credentialsService.upsert(req.user.tenantId, providerId, dto.apiKey);
  }

  @Get('providers/:providerId/credential')
  @RequirePermission('ai.read')
  @HttpCode(200)
  getCredential(@Request() req: any, @Param('providerId') providerId: string) {
    return this.credentialsService.get(req.user.tenantId, providerId);
  }

  @Delete('providers/:providerId/credential')
  @RequirePermission('ai.manage')
  @HttpCode(200)
  removeCredential(@Request() req: any, @Param('providerId') providerId: string) {
    return this.credentialsService.remove(req.user.tenantId, providerId);
  }

  @Post('providers/:providerId/credential/test')
  @RequirePermission('ai.manage')
  @HttpCode(200)
  testCredential(@Request() req: any, @Param('providerId') providerId: string, @Body() dto: TestAiCredentialDto) {
    return this.credentialsService.testConnection(req.user.tenantId, providerId, dto.apiKey);
  }
}
