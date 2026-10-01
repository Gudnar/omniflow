import { Controller, Get, Patch, Post, Body, Request, UseGuards, UseInterceptors, UploadedFile, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ValidationError } from '@omniflow/utils';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { StorageService, MAX_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from '../storage/storage.service';

@Controller('tenant')
export class TenantsController {
  constructor(
    private tenantsService: TenantsService,
    private storageService: StorageService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('tenant.manage')
  @HttpCode(200)
  get(@Request() req: any) {
    return this.tenantsService.get(req.user.tenantId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('tenant.manage')
  @HttpCode(200)
  update(@Request() req: any, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(req.user.tenantId, dto);
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('tenant.manage')
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
  uploadLogo(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.storageService.saveImage(req.user.tenantId, file, 'tenant');
  }
}
