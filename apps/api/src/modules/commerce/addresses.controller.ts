import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Controller('contacts/:contactId/addresses')
export class AddressesController {
  constructor(private addressesService: AddressesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.read')
  @HttpCode(200)
  list(@Param('contactId') contactId: string) {
    return this.addressesService.list(contactId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  create(@Param('contactId') contactId: string, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(contactId, dto);
  }

  @Patch(':addressId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  update(
    @Param('contactId') contactId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(contactId, addressId, dto);
  }

  @Delete(':addressId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  @HttpCode(200)
  remove(@Param('contactId') contactId: string, @Param('addressId') addressId: string) {
    return this.addressesService.remove(contactId, addressId);
  }
}
