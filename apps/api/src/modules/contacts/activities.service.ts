import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { ContactsService } from './contacts.service';
import { CreateActivityDto } from './dto/create-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
  ) {}

  async list(contactId: string) {
    await this.contactsService.findOne(contactId);
    return this.prisma.client.activity.findMany({
      where: { contactId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async create(contactId: string, ownerId: string, dto: CreateActivityDto) {
    await this.contactsService.findOne(contactId);
    return this.prisma.client.activity.create({
      data: {
        contactId,
        ownerId,
        type: dto.type,
        subject: dto.subject,
        description: dto.description,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
  }

  async remove(contactId: string, activityId: string) {
    const activity = await this.prisma.client.activity.findFirst({
      where: { id: activityId, contactId },
    });
    if (!activity) throw new NotFoundError('Activity');
    await this.prisma.client.activity.delete({ where: { id: activityId } });
    return { success: true };
  }
}
