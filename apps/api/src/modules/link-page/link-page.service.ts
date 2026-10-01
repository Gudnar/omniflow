import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';
import { UpdateLinkPageDto } from './dto/link-page.dto';
import { LinkPageItemDto } from './dto/link-page-item.dto';

const ITEMS_ORDER = { sortOrder: 'asc' as const };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '') || 'pagina';
}

@Injectable()
export class LinkPageService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async getOrCreate(tenantId: string) {
    const existing = await this.prisma.client.linkPage.findUnique({
      where: { tenantId },
      include: { items: { orderBy: ITEMS_ORDER } },
    });
    if (existing) return existing;

    const tenant = await this.prisma.client.tenant.findUnique({ where: { id: tenantId } });
    const baseSlug = slugify(tenant?.name ?? 'pagina');

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        const created = await this.prisma.client.linkPage.create({
          data: { slug, title: tenant?.name ?? 'Mis enlaces' },
          include: { items: { orderBy: ITEMS_ORDER } },
        });
        return created;
      } catch (error: any) {
        if (error.code === 'P2002' && attempt < 4) continue;
        throw error;
      }
    }
    throw new ConflictError('Unable to create link page: slug collision');
  }

  async update(tenantId: string, dto: UpdateLinkPageDto) {
    const page = await this.getOrCreate(tenantId);
    try {
      return await this.prisma.client.linkPage.update({
        where: { id: page.id },
        data: { ...dto },
        include: { items: { orderBy: ITEMS_ORDER } },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('A link page with this slug already exists', { field: 'slug' });
      }
      throw error;
    }
  }

  // Same "replace the whole ordered set" approach as EcommerceSectionsService
  // — simpler than per-item PATCH/reorder endpoints for a small, fully
  // re-savable list like this one.
  async replaceItems(tenantId: string, items: LinkPageItemDto[]) {
    const page = await this.getOrCreate(tenantId);

    await this.prisma.client.$transaction(async (tx: any) => {
      await tx.linkPageItem.deleteMany({ where: { linkPageId: page.id } });
      if (items.length) {
        await tx.linkPageItem.createMany({
          data: items.map((item) => ({
            linkPageId: page.id,
            label: item.label,
            url: item.url,
            icon: item.icon,
            sortOrder: item.sortOrder,
            enabled: item.enabled ?? true,
          })),
        });
      }
    });

    return this.getOrCreate(tenantId);
  }

  // Public read — resolves tenant from the slug alone via the unscoped
  // client, mirroring StorefrontService.resolveStoreBySlug. No other
  // tenant-scoped service is called afterwards, so seeding TenantContextService
  // isn't needed here (unlike the storefront, which delegates into cart/order
  // services that require it).
  async getPublicBySlug(slug: string) {
    const page = await this.prisma.raw.linkPage.findUnique({
      where: { slug },
      include: { items: { where: { enabled: true }, orderBy: ITEMS_ORDER } },
    });
    if (!page || page.status !== 'PUBLISHED') {
      throw new NotFoundError('LinkPage');
    }
    return {
      title: page.title,
      bio: page.bio,
      avatarUrl: page.avatarUrl,
      primaryColor: page.primaryColor,
      backgroundColor: page.backgroundColor,
      textColor: page.textColor,
      chatEnabled: page.chatEnabled,
      items: page.items.map((item: any) => ({ id: item.id, label: item.label, url: item.url, icon: item.icon })),
    };
  }

  // Best-effort click counter. IDOR defense: the item must belong to the
  // LinkPage resolved from THIS slug — updateMany's filter (not a bare
  // update({ where: { id } })) is what stops a visitor from passing an
  // itemId that belongs to a different tenant's page.
  async registerClick(slug: string, itemId: string): Promise<void> {
    const page = await this.prisma.raw.linkPage.findUnique({ where: { slug }, select: { id: true } });
    if (!page) return;
    await this.prisma.raw.linkPageItem.updateMany({
      where: { id: itemId, linkPageId: page.id },
      data: { clickCount: { increment: 1 } },
    });
  }

  // Same IDOR defense as registerClick (the item must resolve through THIS
  // slug's page), plus rejecting anything that isn't one of our own
  // uploaded files — an operator could have set a download item's url to an
  // arbitrary external link, which this endpoint has no business proxying.
  async resolveDownload(slug: string, itemId: string): Promise<{ filePath: string; label: string }> {
    const page = await this.prisma.raw.linkPage.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!page || page.status !== 'PUBLISHED') throw new NotFoundError('LinkPage');

    const item = await this.prisma.raw.linkPageItem.findFirst({
      where: { id: itemId, linkPageId: page.id, enabled: true },
    });
    if (!item) throw new NotFoundError('LinkPageItem');

    const filePath = this.storageService.resolveUploadedFilePath(item.url);
    if (!filePath) throw new NotFoundError('LinkPageItem');

    await this.prisma.raw.linkPageItem.update({
      where: { id: item.id },
      data: { clickCount: { increment: 1 } },
    });

    return { filePath, label: item.label };
  }
}
