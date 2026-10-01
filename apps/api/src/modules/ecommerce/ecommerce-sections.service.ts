import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EcommerceStoreService } from './ecommerce-store.service';
import { SectionItemDto } from './dto/section-item.dto';

@Injectable()
export class EcommerceSectionsService {
  constructor(
    private prisma: PrismaService,
    private storeService: EcommerceStoreService,
  ) {}

  // No section-level CRUD is documented — the whole ordered array is
  // replaced in one call (delete-then-recreate), same "replace the set"
  // approach used elsewhere for join-table-like collections.
  async replaceSections(tenantId: string, sections: SectionItemDto[]) {
    const store = await this.storeService.getOrCreate(tenantId);

    await this.prisma.client.$transaction(async (tx: any) => {
      await tx.ecommerceSection.deleteMany({ where: { storeId: store.id } });
      if (sections.length) {
        await tx.ecommerceSection.createMany({
          data: sections.map((s) => ({
            storeId: store.id,
            type: s.type,
            title: s.title,
            subtitle: s.subtitle,
            config: s.config ?? {},
            sortOrder: s.sortOrder,
            enabled: s.enabled ?? true,
          })),
        });
      }
    });

    return this.storeService.getOrCreate(tenantId);
  }
}
