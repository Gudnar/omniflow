import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';
import { CreateTagDto, UpdateTagDto } from './tags.dto';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.client.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const tag = await this.prisma.client.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundError('Tag');
    return tag;
  }

  async create(dto: CreateTagDto) {
    try {
      return await this.prisma.client.tag.create({ data: dto });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Tag name already exists', { field: 'name' });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateTagDto) {
    await this.findOne(id);
    try {
      return await this.prisma.client.tag.update({ where: { id }, data: dto });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('Tag name already exists', { field: 'name' });
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.tag.delete({ where: { id } });
    return { success: true };
  }
}
