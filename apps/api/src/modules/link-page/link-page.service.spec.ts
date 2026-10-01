import { LinkPageService } from './link-page.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';

describe('LinkPageService', () => {
  let service: LinkPageService;
  let prisma: any;
  let tx: any;
  let storageService: any;

  beforeEach(() => {
    tx = {
      linkPageItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    prisma = {
      client: {
        linkPage: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
        tenant: { findUnique: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
      raw: {
        linkPage: { findUnique: jest.fn() },
        linkPageItem: { updateMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      },
    };
    storageService = { resolveUploadedFilePath: jest.fn() };
    service = new LinkPageService(prisma, storageService);
  });

  describe('getOrCreate', () => {
    it('returns the existing page when one exists', async () => {
      const page = { id: 'lp1', tenantId: 't1', slug: 'demo' };
      prisma.client.linkPage.findUnique.mockResolvedValue(page);

      const result = await service.getOrCreate('t1');

      expect(result).toBe(page);
      expect(prisma.client.linkPage.create).not.toHaveBeenCalled();
    });

    it('creates a default page from the tenant name on first access', async () => {
      prisma.client.linkPage.findUnique.mockResolvedValue(null);
      prisma.client.tenant.findUnique.mockResolvedValue({ name: 'Demo Company' });
      prisma.client.linkPage.create.mockResolvedValue({ id: 'lp1', slug: 'demo-company' });

      await service.getOrCreate('t1');

      expect(prisma.client.linkPage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { slug: 'demo-company', title: 'Demo Company' } }),
      );
    });

    it('retries with a random suffix on a slug collision', async () => {
      prisma.client.linkPage.findUnique.mockResolvedValue(null);
      prisma.client.tenant.findUnique.mockResolvedValue({ name: 'Demo Company' });
      prisma.client.linkPage.create
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({ id: 'lp1', slug: 'demo-company-ab12' });

      const result = await service.getOrCreate('t1');

      expect(result.id).toBe('lp1');
      expect(prisma.client.linkPage.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('maps a duplicate slug to ConflictError', async () => {
      prisma.client.linkPage.findUnique.mockResolvedValue({ id: 'lp1' });
      prisma.client.linkPage.update.mockRejectedValue({ code: 'P2002' });

      await expect(service.update('t1', { slug: 'taken' } as any)).rejects.toThrow(ConflictError);
    });
  });

  describe('replaceItems', () => {
    it('deletes existing items and recreates them from the given array', async () => {
      prisma.client.linkPage.findUnique.mockResolvedValue({ id: 'lp1' });

      await service.replaceItems('t1', [
        { label: 'WhatsApp', url: 'https://wa.me/123', sortOrder: 0, icon: 'whatsapp' } as any,
        { label: 'Instagram', url: 'https://instagram.com/x', sortOrder: 1, enabled: false } as any,
      ]);

      expect(tx.linkPageItem.deleteMany).toHaveBeenCalledWith({ where: { linkPageId: 'lp1' } });
      expect(tx.linkPageItem.createMany).toHaveBeenCalledWith({
        data: [
          { linkPageId: 'lp1', label: 'WhatsApp', url: 'https://wa.me/123', icon: 'whatsapp', sortOrder: 0, enabled: true },
          { linkPageId: 'lp1', label: 'Instagram', url: 'https://instagram.com/x', icon: undefined, sortOrder: 1, enabled: false },
        ],
      });
    });
  });

  describe('getPublicBySlug', () => {
    it('throws NotFoundError when the page does not exist', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue(null);
      await expect(service.getPublicBySlug('missing')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the page is still a draft', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({ status: 'DRAFT', items: [] });
      await expect(service.getPublicBySlug('draft-page')).rejects.toThrow(NotFoundError);
    });

    it('never exposes tenantId or clickCount on published items', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        title: 'Demo',
        bio: 'bio',
        avatarUrl: null,
        primaryColor: '#2563eb',
        backgroundColor: '#fff',
        textColor: '#111',
        items: [{ id: 'i1', label: 'WhatsApp', url: 'https://wa.me/1', icon: 'whatsapp', clickCount: 42, tenantId: 't1' }],
      });

      const result = await service.getPublicBySlug('demo');

      expect(result.items).toEqual([{ id: 'i1', label: 'WhatsApp', url: 'https://wa.me/1', icon: 'whatsapp' }]);
      expect((result as any).tenantId).toBeUndefined();
    });
  });

  describe('registerClick', () => {
    it('does nothing when the slug does not resolve', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue(null);
      await service.registerClick('missing', 'i1');
      expect(prisma.raw.linkPageItem.updateMany).not.toHaveBeenCalled();
    });

    // IDOR defense: an itemId belonging to a DIFFERENT tenant's link page must
    // not be incrementable just because it's a valid item id somewhere.
    it('scopes the increment to the item AND the resolved link page (IDOR defense)', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({ id: 'lp1' });

      await service.registerClick('demo', 'foreign-item-id');

      expect(prisma.raw.linkPageItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'foreign-item-id', linkPageId: 'lp1' },
        data: { clickCount: { increment: 1 } },
      });
    });
  });

  describe('resolveDownload', () => {
    it('throws NotFoundError when the page does not exist or is not published', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue(null);
      await expect(service.resolveDownload('missing', 'i1')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the item does not belong to that page (IDOR defense)', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({ id: 'lp1', status: 'PUBLISHED' });
      prisma.raw.linkPageItem.findFirst.mockResolvedValue(null);

      await service.resolveDownload('demo', 'foreign-item').catch(() => {});

      expect(prisma.raw.linkPageItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'foreign-item', linkPageId: 'lp1', enabled: true },
      });
      await expect(service.resolveDownload('demo', 'foreign-item')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the item url is not one of our own uploaded files', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({ id: 'lp1', status: 'PUBLISHED' });
      prisma.raw.linkPageItem.findFirst.mockResolvedValue({ id: 'i1', url: 'https://example.com/not-ours.pdf', label: 'Catálogo' });
      storageService.resolveUploadedFilePath.mockReturnValue(null);

      await expect(service.resolveDownload('demo', 'i1')).rejects.toThrow(NotFoundError);
      expect(prisma.raw.linkPageItem.update).not.toHaveBeenCalled();
    });

    it('increments the click count and returns the resolved file path', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({ id: 'lp1', status: 'PUBLISHED' });
      prisma.raw.linkPageItem.findFirst.mockResolvedValue({ id: 'i1', url: 'http://api/uploads/link-page/t1/x.pdf', label: 'Catálogo' });
      storageService.resolveUploadedFilePath.mockReturnValue('/srv/uploads/link-page/t1/x.pdf');

      const result = await service.resolveDownload('demo', 'i1');

      expect(prisma.raw.linkPageItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { clickCount: { increment: 1 } },
      });
      expect(result).toEqual({ filePath: '/srv/uploads/link-page/t1/x.pdf', label: 'Catálogo' });
    });
  });
});
