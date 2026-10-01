import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';
import { CreateBlackoutDateDto } from './dto/blackout-date.dto';

@Injectable()
export class BookingBlackoutDatesService {
  constructor(private prisma: PrismaService) {}

  async list(branchId: string) {
    return this.prisma.client.bookingBlackoutDate.findMany({
      where: { branchId },
      orderBy: { date: 'asc' },
    });
  }

  async create(dto: CreateBlackoutDateDto) {
    const date = new Date(dto.date);
    const existing = await this.prisma.client.bookingBlackoutDate.findUnique({
      where: { branchId_date: { branchId: dto.branchId, date } },
    });
    if (existing) throw new ConflictError('This date is already marked as a blackout date for this branch');

    return this.prisma.client.bookingBlackoutDate.create({
      data: { branchId: dto.branchId, date, reason: dto.reason },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.client.bookingBlackoutDate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('BookingBlackoutDate');
    await this.prisma.client.bookingBlackoutDate.delete({ where: { id } });
  }
}
