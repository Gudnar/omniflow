import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto, ListCampaignsQueryDto } from './dto/campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.read')
  @HttpCode(200)
  list(@Query() query: ListCampaignsQueryDto) {
    return this.campaignsService.list(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Get(':id/recipients')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.read')
  @HttpCode(200)
  listRecipients(@Param('id') id: string) {
    return this.campaignsService.listRecipients(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.manage')
  create(@Request() req: any, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto, req.user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  @Post(':id/send')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.manage')
  send(@Param('id') id: string) {
    return this.campaignsService.send(id);
  }
}
