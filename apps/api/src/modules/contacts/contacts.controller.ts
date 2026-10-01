import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { AttachTagDto } from './dto/contact-tags.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.read')
  @HttpCode(200)
  list(@Request() req: any, @Query() query: ListContactsQueryDto) {
    return this.contactsService.list(req.user.tenantId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }

  @Post(':id/tags')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  attachTag(@Param('id') id: string, @Body() dto: AttachTagDto) {
    return this.contactsService.attachTag(id, dto.tagId);
  }

  @Delete(':id/tags/:tagId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  @HttpCode(200)
  detachTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.contactsService.detachTag(id, tagId);
  }
}
