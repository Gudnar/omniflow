import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { UpdateUserScheduleDto, CreateTimeOffDto } from './dto/user-schedule.dto';

@Injectable()
export class UserSchedulesService {
  constructor(private prisma: PrismaService) {}

  // Lazily provisions the user's ACTIVE UserSchedule (empty intervals) on
  // first access — same lazy-init precedent as EcommerceStoreService.getOrCreate.
  async getOrCreate(userId: string) {
    const existing = await this.prisma.client.userSchedule.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { intervals: { orderBy: { dayOfWeek: 'asc' } } },
    });
    if (existing) return existing;

    return this.prisma.client.userSchedule.create({
      data: { userId, name: 'Horario regular' },
      include: { intervals: true },
    });
  }

  async updateIntervals(userId: string, dto: UpdateUserScheduleDto) {
    const schedule = await this.getOrCreate(userId);

    await this.prisma.client.$transaction(async (tx: any) => {
      if (dto.name) {
        await tx.userSchedule.update({ where: { id: schedule.id }, data: { name: dto.name } });
      }
      await tx.userScheduleInterval.deleteMany({ where: { userScheduleId: schedule.id } });
      if (dto.intervals.length) {
        await tx.userScheduleInterval.createMany({
          data: dto.intervals.map((i) => ({ userScheduleId: schedule.id, ...i })),
        });
      }
    });

    return this.getOrCreate(userId);
  }

  async listTimeOff(userId: string) {
    return this.prisma.client.userTimeOff.findMany({
      where: { userId },
      orderBy: { startAt: 'desc' },
    });
  }

  async addTimeOff(userId: string, dto: CreateTimeOffDto) {
    return this.prisma.client.userTimeOff.create({
      data: { userId, startAt: new Date(dto.startAt), endAt: new Date(dto.endAt), reason: dto.reason },
    });
  }

  async removeTimeOff(userId: string, id: string) {
    const entry = await this.prisma.client.userTimeOff.findFirst({ where: { id, userId } });
    if (!entry) throw new NotFoundError('UserTimeOff');
    await this.prisma.client.userTimeOff.delete({ where: { id } });
    return { success: true };
  }
}
