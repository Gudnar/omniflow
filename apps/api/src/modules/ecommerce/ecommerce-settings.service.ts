import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EcommerceStoreService } from './ecommerce-store.service';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateFulfillmentDto } from './dto/update-fulfillment.dto';

@Injectable()
export class EcommerceSettingsService {
  constructor(
    private prisma: PrismaService,
    private storeService: EcommerceStoreService,
  ) {}

  async updateTheme(tenantId: string, dto: UpdateThemeDto) {
    const store = await this.storeService.getOrCreate(tenantId);
    await this.prisma.client.ecommerceStoreSettings.update({
      where: { storeId: store.id },
      data: dto,
    });
    return this.storeService.getOrCreate(tenantId);
  }

  async updateLocation(tenantId: string, dto: UpdateLocationDto) {
    const store = await this.storeService.getOrCreate(tenantId);
    await this.prisma.client.ecommerceStore.update({
      where: { id: store.id },
      data: { locationSource: dto.locationSource },
    });
    return this.storeService.getOrCreate(tenantId);
  }

  async updateFulfillment(tenantId: string, dto: UpdateFulfillmentDto) {
    const store = await this.storeService.getOrCreate(tenantId);
    await this.prisma.client.ecommerceStore.update({
      where: { id: store.id },
      data: { fulfillmentOptions: dto.fulfillmentOptions },
    });
    return this.storeService.getOrCreate(tenantId);
  }
}
