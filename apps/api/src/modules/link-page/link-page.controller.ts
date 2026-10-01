import { Controller, Get, Patch, Post, Body, Request, UseGuards, UseInterceptors, UploadedFile, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ValidationError } from '@omniflow/utils';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import {
  StorageService,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_DOWNLOAD_SIZE_BYTES,
  ALLOWED_DOWNLOAD_MIME_TYPES,
} from '../storage/storage.service';
import { LinkPageService } from './link-page.service';
import { UpdateLinkPageDto } from './dto/link-page.dto';
import { UpdateLinkPageItemsDto } from './dto/link-page-item.dto';

@Controller('link-page')
export class LinkPageController {
  constructor(
    private linkPageService: LinkPageService,
    private storageService: StorageService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('link-page.read')
  @HttpCode(200)
  get(@Request() req: any) {
    return this.linkPageService.getOrCreate(req.user.tenantId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('link-page.manage')
  @HttpCode(200)
  update(@Request() req: any, @Body() dto: UpdateLinkPageDto) {
    return this.linkPageService.update(req.user.tenantId, dto);
  }

  @Patch('items')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('link-page.manage')
  @HttpCode(200)
  updateItems(@Request() req: any, @Body() dto: UpdateLinkPageItemsDto) {
    return this.linkPageService.replaceItems(req.user.tenantId, dto.items);
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('link-page.manage')
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
  uploadAvatar(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.storageService.saveImage(req.user.tenantId, file, 'link-page');
  }

  @Post('download-file')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('link-page.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOWNLOAD_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_DOWNLOAD_MIME_TYPES[file.mimetype]) {
          return cb(new ValidationError('Unsupported file type. Use PDF, PNG, JPEG, WEBP or GIF.'), false);
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(201)
  uploadDownloadFile(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.storageService.saveDownloadFile(req.user.tenantId, file);
  }
}
