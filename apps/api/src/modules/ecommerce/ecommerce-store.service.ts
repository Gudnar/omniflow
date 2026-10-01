import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationError } from '@omniflow/utils';
import { UpdateStoreDto } from './dto/update-store.dto';

// Explicit select (not `settings: true`) — the raw row also carries
// id/tenantId/storeId/updatedAt, which then (a) got echoed back into the
// admin's draftSettings and re-sent verbatim to PATCH /ecommerce/theme,
// tripping the global ValidationPipe's forbidNonWhitelisted and making
// every "Guardar cambios" in Apariencia fail with 400, and (b) leaked
// those internal ids to anonymous callers of the public GET /storefront/:slug.
const STORE_INCLUDE = {
  settings: {
    select: {
      logo: true,
      mobileLogo: true,
      favicon: true,
      heroImage: true,
      mobileHeroImage: true,
      primaryColor: true,
      secondaryColor: true,
      buttonColor: true,
      textColor: true,
      backgroundColor: true,
      promoColor: true,
      fontFamily: true,
    },
  },
  sections: { orderBy: { sortOrder: 'asc' as const } },
  branches: { select: { branchId: true } },
};

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'tienda';
}

function serialize(store: any) {
  const { branches, ...rest } = store;
  return { ...rest, branchIds: branches.map((b: any) => b.branchId) };
}

@Injectable()
export class EcommerceStoreService {
  constructor(private prisma: PrismaService) {}

  // Lazily provisions a default DRAFT store + settings row for the tenant on
  // first access — there is no separate `POST /ecommerce/store` in the
  // documented API contract, so this is the tenant's only entry point.
  async getOrCreate(tenantId: string) {
    const existing = await this.prisma.client.ecommerceStore.findUnique({
      where: { tenantId },
      include: STORE_INCLUDE,
    });
    if (existing) return serialize(existing);

    const tenant = await this.prisma.client.tenant.findUnique({ where: { id: tenantId } });
    const created = await this.prisma.client.ecommerceStore.create({
      data: {
        name: tenant?.name ?? 'Mi tienda',
        slug: slugify(tenant?.name ?? 'tienda'),
        // Nested relation writes are NOT covered by the tenant-scoping
        // extension's auto-injection (it only patches the top-level model's
        // args) — tenantId must be supplied explicitly here.
        settings: { create: { tenantId } },
      },
      include: STORE_INCLUDE,
    });
    return serialize(created);
  }

  async update(tenantId: string, dto: UpdateStoreDto) {
    const store = await this.getOrCreate(tenantId);

    if (dto.branchIds) {
      const validBranches = await this.prisma.client.branch.findMany({
        where: { id: { in: dto.branchIds } },
        select: { id: true },
      });
      if (validBranches.length !== dto.branchIds.length) {
        throw new ValidationError('One or more branchIds do not belong to this tenant');
      }
    }

    await this.prisma.client.$transaction(async (tx: any) => {
      await tx.ecommerceStore.update({
        where: { id: store.id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.operationMode !== undefined && { operationMode: dto.operationMode }),
          ...(dto.chatEnabled !== undefined && { chatEnabled: dto.chatEnabled }),
        },
      });

      if (dto.branchIds) {
        await tx.ecommerceStoreBranch.deleteMany({ where: { storeId: store.id } });
        if (dto.branchIds.length) {
          await tx.ecommerceStoreBranch.createMany({
            data: dto.branchIds.map((branchId: string) => ({ storeId: store.id, branchId })),
          });
        }
      }
    });

    return this.getOrCreate(tenantId);
  }

  async publish(tenantId: string) {
    const store = await this.getOrCreate(tenantId);
    await this.prisma.client.ecommerceStore.update({
      where: { id: store.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    return this.getOrCreate(tenantId);
  }

  // Thin alias — the assembled shape doubles as the "what would the public
  // storefront show" payload for an eventual public storefront to consume.
  async getPreview(tenantId: string) {
    return this.getOrCreate(tenantId);
  }
}
