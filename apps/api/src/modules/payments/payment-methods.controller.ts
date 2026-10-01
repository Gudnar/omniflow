import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, Request, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ValidationError } from '@omniflow/utils';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';
import { StorageService, MAX_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from '../storage/storage.service';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(
    private paymentMethodsService: PaymentMethodsService,
    private storageService: StorageService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('payments.read')
  @HttpCode(200)
  list() {
    return this.paymentMethodsService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('payments.manage')
  create(@Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('payments.manage')
  update(@Param('id') id: string, @Body() dto: UpdatePaymentMethodDto) {
    return this.paymentMethodsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('payments.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.paymentMethodsService.remove(id);
  }

  @Post('qr-image')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('payments.manage')
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
  uploadQrImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.storageService.saveImage(req.user.tenantId, file, 'payment-methods');
  }
}
