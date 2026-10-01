import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';
import { EventsService } from '../events/events.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';

const CONTACT_INCLUDE = {
  company: { select: { id: true, name: true } },
  tags: { include: { tag: true } },
};

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  async list(tenantId: string, filters: ListContactsQueryDto) {
    return this.prisma.client.contact.findMany({
      where: {
        tenantId,
        ...(filters.status && { status: filters.status }),
        ...(filters.type && { type: filters.type }),
        ...(filters.companyId && { companyId: filters.companyId }),
        ...(filters.search && {
          name: { contains: filters.search, mode: 'insensitive' },
        }),
      },
      include: CONTACT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const contact = await this.prisma.client.contact.findUnique({
      where: { id },
      include: CONTACT_INCLUDE,
    });
    if (!contact) throw new NotFoundError('Contact');
    return contact;
  }

  async create(dto: CreateContactDto) {
    const { tagIds, ...data } = dto;
    const contact = await this.prisma.client.$transaction(async (tx: any) => {
      const created = await tx.contact.create({ data });

      if (tagIds?.length) {
        await tx.contactTag.createMany({
          data: tagIds.map((tagId) => ({ contactId: created.id, tagId })),
          skipDuplicates: true,
        });
      }

      return tx.contact.findUnique({ where: { id: created.id }, include: CONTACT_INCLUDE });
    });

    await this.eventsService.emit('contact.created', { contactId: contact.id, name: contact.name }, contact.id);
    return contact;
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.findOne(id);
    return this.prisma.client.contact.update({
      where: { id },
      data: dto,
      include: CONTACT_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.contact.delete({ where: { id } });
    return { success: true };
  }

  async attachTag(contactId: string, tagId: string) {
    await this.findOne(contactId);

    const tag = await this.prisma.client.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundError('Tag');

    try {
      await this.prisma.client.contactTag.create({ data: { contactId, tagId } });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Tag already attached to this contact');
      }
      throw error;
    }

    await this.eventsService.emit(
      'contact.tag_added',
      { contactId, tagId, tagName: tag.name },
      contactId,
    );

    return this.findOne(contactId);
  }

  async detachTag(contactId: string, tagId: string) {
    await this.prisma.client.contactTag.deleteMany({ where: { contactId, tagId } });
    return this.findOne(contactId);
  }
}
