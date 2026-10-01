import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { ContactsService } from '../contacts/contacts.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
  ) {}

  async list(contactId: string) {
    await this.contactsService.findOne(contactId);
    return this.prisma.client.customerAddress.findMany({
      where: { contactId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(contactId: string, dto: CreateAddressDto) {
    await this.contactsService.findOne(contactId);

    if (dto.isDefault) {
      await this.prisma.client.customerAddress.updateMany({ where: { contactId }, data: { isDefault: false } });
    }

    return this.prisma.client.customerAddress.create({
      data: { ...dto, contactId },
    });
  }

  async update(contactId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.prisma.client.customerAddress.findFirst({ where: { id: addressId, contactId } });
    if (!address) throw new NotFoundError('CustomerAddress');

    if (dto.isDefault) {
      await this.prisma.client.customerAddress.updateMany({ where: { contactId }, data: { isDefault: false } });
    }

    return this.prisma.client.customerAddress.update({ where: { id: addressId }, data: dto });
  }

  async remove(contactId: string, addressId: string) {
    const address = await this.prisma.client.customerAddress.findFirst({ where: { id: addressId, contactId } });
    if (!address) throw new NotFoundError('CustomerAddress');
    await this.prisma.client.customerAddress.delete({ where: { id: addressId } });
    return { success: true };
  }
}
