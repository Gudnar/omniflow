import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

function serializeService(service: any) {
  return { ...service, price: Number(service.price) };
}

@Injectable()
export class BookingServicesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const services = await this.prisma.client.bookingService.findMany({
      include: { qualifiedUsers: true },
      orderBy: { name: 'asc' },
    });
    return services.map(serializeService);
  }

  async findOne(id: string) {
    const service = await this.prisma.client.bookingService.findUnique({
      where: { id },
      include: { qualifiedUsers: true },
    });
    if (!service) throw new NotFoundError('BookingService');
    return serializeService(service);
  }

  async create(dto: CreateServiceDto) {
    try {
      const created = await this.prisma.client.bookingService.create({ data: dto });
      return serializeService(created);
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('A service with this slug already exists', { field: 'slug' });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);
    try {
      const updated = await this.prisma.client.bookingService.update({ where: { id }, data: dto });
      return serializeService(updated);
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('A service with this slug already exists', { field: 'slug' });
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.bookingService.delete({ where: { id } });
    return { success: true };
  }

  async addQualifiedStaff(serviceId: string, userId: string) {
    await this.findOne(serviceId);
    try {
      await this.prisma.client.bookingServiceUser.create({ data: { serviceId, userId } });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('This user is already qualified for this service');
      }
      throw error;
    }
    return this.findOne(serviceId);
  }

  async removeQualifiedStaff(serviceId: string, userId: string) {
    await this.prisma.client.bookingServiceUser.deleteMany({ where: { serviceId, userId } });
    return this.findOne(serviceId);
  }
}
