import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { safeDownloadFilename } from '@omniflow/utils';
import { Public } from '../auth/decorators';
import { StorefrontService } from './storefront.service';
import { BookingStorefrontService } from './booking-storefront.service';
import { AddCartItemDto, UpdateCartItemDto, CheckoutDto } from '../commerce/dto/cart.dto';
import { SessionLocationDto } from '../commerce/dto/commerce-session.dto';
import { CreateAddressDto } from '../commerce/dto/address.dto';
import { PublicAvailabilityQueryDto, PublicBookAppointmentDto, PublicBookAppointmentGroupDto } from './dto/public-booking.dto';

/**
 * Public, unauthenticated storefront surface — a customer's browser reaches
 * these routes directly (via the link an operator/agent sends over
 * WhatsApp), never a staff JWT. @Public() bypasses the global JwtAuthGuard;
 * StorefrontService is the only thing standing between a request and tenant
 * data, resolving tenant from the slug/token itself. See
 * storefront.service.ts's docblock for the full security rationale.
 */
@Controller('storefront')
@Public()
export class StorefrontController {
  constructor(
    private storefrontService: StorefrontService,
    private bookingStorefrontService: BookingStorefrontService,
  ) {}

  @Get(':slug')
  @HttpCode(200)
  getStore(@Param('slug') slug: string) {
    return this.storefrontService.getStore(slug);
  }

  @Get(':slug/products')
  @HttpCode(200)
  listProducts(@Param('slug') slug: string, @Query('branchId') branchId?: string) {
    return this.storefrontService.listProducts(slug, branchId);
  }

  @Get(':slug/products/:productId')
  @HttpCode(200)
  getProduct(@Param('slug') slug: string, @Param('productId') productId: string, @Query('branchId') branchId?: string) {
    return this.storefrontService.getProduct(slug, productId, branchId);
  }

  @Get(':slug/payment-methods')
  @HttpCode(200)
  getPaymentMethods(@Param('slug') slug: string) {
    return this.storefrontService.getPaymentMethods(slug);
  }

  // Same forced-download pattern as LinkPagePublicController's catalog
  // download: res.download() sets Content-Disposition: attachment, which
  // (unlike the HTML `download` attribute) isn't subject to the
  // same-origin restriction browsers apply to that attribute.
  @Get(':slug/payment-methods/:id/download')
  async downloadPaymentQr(@Param('slug') slug: string, @Param('id') id: string, @Res() res: Response) {
    const { filePath, label } = await this.storefrontService.getQrDownload(slug, id);
    const extension = filePath.slice(filePath.lastIndexOf('.'));
    res.download(filePath, safeDownloadFilename(label, extension));
  }

  @Get('sessions/:token')
  @HttpCode(200)
  getSession(@Param('token') token: string) {
    return this.storefrontService.getSession(token);
  }

  @Post('sessions/:token/cart/items')
  addItem(@Param('token') token: string, @Body() dto: AddCartItemDto) {
    return this.storefrontService.addItem(token, dto);
  }

  @Patch('sessions/:token/cart/items/:itemId')
  updateItem(@Param('token') token: string, @Param('itemId') itemId: string, @Body() dto: UpdateCartItemDto) {
    return this.storefrontService.updateItem(token, itemId, dto);
  }

  @Delete('sessions/:token/cart/items/:itemId')
  @HttpCode(200)
  removeItem(@Param('token') token: string, @Param('itemId') itemId: string) {
    return this.storefrontService.removeItem(token, itemId);
  }

  @Post('sessions/:token/location')
  recordLocation(@Param('token') token: string, @Body() dto: SessionLocationDto) {
    return this.storefrontService.recordLocation(token, dto);
  }

  @Post('sessions/:token/nearest-branch')
  setNearestBranch(@Param('token') token: string, @Body() dto: SessionLocationDto) {
    return this.storefrontService.setNearestBranch(token, dto);
  }

  @Post('sessions/:token/addresses')
  createAddress(@Param('token') token: string, @Body() dto: CreateAddressDto) {
    return this.storefrontService.createAddress(token, dto);
  }

  @Post('sessions/:token/checkout')
  checkout(@Param('token') token: string, @Body() dto: CheckoutDto) {
    return this.storefrontService.checkout(token, dto);
  }

  @Get(':slug/booking/services')
  @HttpCode(200)
  listBookingServices(@Param('slug') slug: string) {
    return this.bookingStorefrontService.listServices(slug);
  }

  @Get('sessions/:token/booking/availability')
  @HttpCode(200)
  getBookingAvailability(@Param('token') token: string, @Query() query: PublicAvailabilityQueryDto) {
    return this.bookingStorefrontService.getAvailability(token, query);
  }

  @Get('sessions/:token/booking/blackout-dates')
  @HttpCode(200)
  listBookingBlackoutDates(@Param('token') token: string) {
    return this.bookingStorefrontService.listBlackoutDates(token);
  }

  @Post('sessions/:token/booking/appointments')
  bookAppointment(@Param('token') token: string, @Body() dto: PublicBookAppointmentDto) {
    return this.bookingStorefrontService.bookAppointment(token, dto);
  }

  @Post('sessions/:token/booking/appointments/group')
  bookAppointmentGroup(@Param('token') token: string, @Body() dto: PublicBookAppointmentGroupDto) {
    return this.bookingStorefrontService.bookAppointmentGroup(token, dto);
  }

  @Get('sessions/:token/purchases')
  @HttpCode(200)
  getPurchases(@Param('token') token: string) {
    return this.storefrontService.getPurchases(token);
  }
}
