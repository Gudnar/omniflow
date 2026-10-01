import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';
import { CreateResourceDto, UpdateResourceDto, CreateScheduleEntryDto } from './dto/resource.dto';

const RESOURCE_INCLUDE = {
  branch: { select: { id: true, name: true } },
  services: { include: { service: { select: { id: true, name: true } } } },
  schedule: { orderBy: { dayOfWeek: 'asc' as const } },
};

@Injectable()
export class BookingResourcesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.bookingResource.findMany({
      include: RESOURCE_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const resource = await this.prisma.client.bookingResource.findUnique({
      where: { id },
      include: RESOURCE_INCLUDE,
    });
    if (!resource) throw new NotFoundError('BookingResource');
    return resource;
  }

  async create(dto: CreateResourceDto) {
    if (dto.type !== 'STAFF' && dto.userId) {
      throw new ValidationError('userId is only meaningful for STAFF resources');
    }
    const created = await this.prisma.client.bookingResource.create({ data: dto });
    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateResourceDto) {
    const resource = await this.findOne(id);
    const type = dto.type ?? resource.type;
    if (type !== 'STAFF' && (dto.userId ?? resource.userId)) {
      throw new ValidationError('userId is only meaningful for STAFF resources');
    }
    await this.prisma.client.bookingResource.update({ where: { id }, data: dto });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.bookingResource.delete({ where: { id } });
    return { success: true };
  }

  async assignService(resourceId: string, serviceId: string) {
    const resource = await this.findOne(resourceId);

    if (resource.type === 'STAFF' && resource.userId) {
      const qualified = await this.prisma.client.bookingServiceUser.findFirst({
        where: { serviceId, userId: resource.userId },
      });
      if (!qualified) {
        throw new ValidationError('This staff member is not qualified for this service');
      }
    }

    try {
      await this.prisma.client.bookingResourceService.create({ data: { resourceId, serviceId } });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('This resource already offers this service');
      }
      throw error;
    }
    return this.findOne(resourceId);
  }

  async unassignService(resourceId: string, serviceId: string) {
    await this.prisma.client.bookingResourceService.deleteMany({ where: { resourceId, serviceId } });
    return this.findOne(resourceId);
  }

  async addScheduleEntry(resourceId: string, dto: CreateScheduleEntryDto) {
    await this.findOne(resourceId);
    if (dto.endMinute <= dto.startMinute) {
      throw new ValidationError('endMinute must be after startMinute');
    }
    await this.prisma.client.bookingResourceSchedule.create({ data: { resourceId, ...dto } });
    return this.findOne(resourceId);
  }

  async removeScheduleEntry(resourceId: string, entryId: string) {
    const entry = await this.prisma.client.bookingResourceSchedule.findFirst({
      where: { id: entryId, resourceId },
    });
    if (!entry) throw new NotFoundError('BookingResourceSchedule');
    await this.prisma.client.bookingResourceSchedule.delete({ where: { id: entryId } });
    return this.findOne(resourceId);
  }
}
