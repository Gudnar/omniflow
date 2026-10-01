import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.client.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Category');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    try {
      return await this.prisma.client.category.create({ data: dto });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('A category with this slug already exists', { field: 'slug' });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    try {
      return await this.prisma.client.category.update({ where: { id }, data: dto });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('A category with this slug already exists', { field: 'slug' });
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.category.delete({ where: { id } });
    return { success: true };
  }
}
