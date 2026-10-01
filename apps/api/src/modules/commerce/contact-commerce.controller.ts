import { Controller, Get, Post, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { ContactCommerceService } from './contact-commerce.service';

@Controller('contacts/:contactId')
export class ContactCommerceController {
  constructor(private contactCommerceService: ContactCommerceService) {}

  @Get('active-cart')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.read')
  @HttpCode(200)
  getActiveCart(@Param('contactId') contactId: string) {
    return this.contactCommerceService.getActiveCart(contactId);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  listOrders(@Param('contactId') contactId: string) {
    return this.contactCommerceService.listOrders(contactId);
  }

  @Post('storefront-link')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  generateStorefrontLink(@Param('contactId') contactId: string) {
    return this.contactCommerceService.generateStorefrontLink(contactId);
  }
}
