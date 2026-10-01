import { Controller, Get, Patch, Post, Body, UseGuards, UseInterceptors, UploadedFile, Request, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ValidationError } from '@omniflow/utils';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { EcommerceStoreService } from './ecommerce-store.service';
import { EcommerceSettingsService } from './ecommerce-settings.service';
import { EcommerceSectionsService } from './ecommerce-sections.service';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateFulfillmentDto } from './dto/update-fulfillment.dto';
import { UpdateSectionsDto } from './dto/update-sections.dto';
import { StorageService, MAX_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from '../storage/storage.service';

@Controller('ecommerce')
export class EcommerceController {
  constructor(
    private storeService: EcommerceStoreService,
    private settingsService: EcommerceSettingsService,
    private sectionsService: EcommerceSectionsService,
    private storageService: StorageService,
  ) {}

  @Get('store')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.read')
  @HttpCode(200)
  getStore(@Request() req: any) {
    return this.storeService.getOrCreate(req.user.tenantId);
  }

  @Patch('store')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.manage')
  @HttpCode(200)
  updateStore(@Request() req: any, @Body() dto: UpdateStoreDto) {
    return this.storeService.update(req.user.tenantId, dto);
  }

  @Post('store/publish')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.manage')
  @HttpCode(200)
  publish(@Request() req: any) {
    return this.storeService.publish(req.user.tenantId);
  }

  @Get('preview')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.read')
  @HttpCode(200)
  getPreview(@Request() req: any) {
    return this.storeService.getPreview(req.user.tenantId);
  }

  @Patch('theme')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.manage')
  @HttpCode(200)
  updateTheme(@Request() req: any, @Body() dto: UpdateThemeDto) {
    return this.settingsService.updateTheme(req.user.tenantId, dto);
  }

  @Patch('sections')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.manage')
  @HttpCode(200)
  updateSections(@Request() req: any, @Body() dto: UpdateSectionsDto) {
    return this.sectionsService.replaceSections(req.user.tenantId, dto.sections);
  }

  @Patch('location')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.manage')
  @HttpCode(200)
  updateLocation(@Request() req: any, @Body() dto: UpdateLocationDto) {
    return this.settingsService.updateLocation(req.user.tenantId, dto);
  }

  @Patch('fulfillment')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.manage')
  @HttpCode(200)
  updateFulfillment(@Request() req: any, @Body() dto: UpdateFulfillmentDto) {
    return this.settingsService.updateFulfillment(req.user.tenantId, dto);
  }

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('ecommerce.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME_TYPES[file.mimetype]) {
          return cb(new ValidationError('Unsupported image type. Use PNG, JPEG, WEBP or GIF.'), false);
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(201)
  uploadImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.storageService.saveImage(req.user.tenantId, file);
  }
}
