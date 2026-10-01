import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSegmentDto, UpdateSegmentDto } from './dto/segment.dto';

@Injectable()
export class SegmentsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.segment.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const segment = await this.prisma.client.segment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundError('Segment');
    return segment;
  }

  async create(dto: CreateSegmentDto) {
    return this.prisma.client.segment.create({
      data: { name: dto.name, description: dto.description, filterQuery: dto.filterQuery ?? {} },
    });
  }

  async update(id: string, dto: UpdateSegmentDto) {
    await this.findOne(id);
    return this.prisma.client.segment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.filterQuery !== undefined && { filterQuery: dto.filterQuery }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.segment.delete({ where: { id } });
    return { success: true };
  }

  /** The actual AND-of-fields Prisma query a segment's filterQuery compiles to. */
  private buildWhere(filterQuery: any) {
    const filter = filterQuery ?? {};
    return {
      ...(filter.status && { status: filter.status }),
      ...(filter.type && { type: filter.type }),
      ...(filter.tagIds?.length && { tags: { some: { tagId: { in: filter.tagIds } } } }),
    };
  }

  async resolveContactIds(id: string): Promise<string[]> {
    const segment = await this.findOne(id);
    const contacts = await this.prisma.client.contact.findMany({
      where: this.buildWhere(segment.filterQuery),
      select: { id: true },
    });
    return contacts.map((c: any) => c.id);
  }

  async previewCount(id: string): Promise<number> {
    const segment = await this.findOne(id);
    return this.prisma.client.contact.count({ where: this.buildWhere(segment.filterQuery) });
  }
}
