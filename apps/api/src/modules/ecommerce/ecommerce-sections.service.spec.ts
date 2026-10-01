import { EcommerceSectionsService } from './ecommerce-sections.service';

describe('EcommerceSectionsService', () => {
  let service: EcommerceSectionsService;
  let prisma: any;
  let tx: any;
  let storeService: any;

  const store = { id: 'store-1', tenantId: 't1' };

  beforeEach(() => {
    tx = {
      ecommerceSection: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    prisma = {
      client: { $transaction: jest.fn((cb: any) => cb(tx)) },
    };
    storeService = { getOrCreate: jest.fn().mockResolvedValue(store) };
    service = new EcommerceSectionsService(prisma, storeService);
  });

  it('deletes the existing sections and recreates them from the given array', async () => {
    const sections = [
      { type: 'BANNER', title: 'Promo', sortOrder: 0, config: { imageUrl: 'https://x/img.png' } },
      { type: 'TEXT_BLOCK', sortOrder: 1 },
    ];

    await service.replaceSections('t1', sections as any);

    expect(tx.ecommerceSection.deleteMany).toHaveBeenCalledWith({ where: { storeId: 'store-1' } });
    expect(tx.ecommerceSection.createMany).toHaveBeenCalledWith({
      data: [
        {
          storeId: 'store-1',
          type: 'BANNER',
          title: 'Promo',
          subtitle: undefined,
          config: { imageUrl: 'https://x/img.png' },
          sortOrder: 0,
          enabled: true,
        },
        {
          storeId: 'store-1',
          type: 'TEXT_BLOCK',
          title: undefined,
          subtitle: undefined,
          config: {},
          sortOrder: 1,
          enabled: true,
        },
      ],
    });
  });

  it('deletes without recreating when given an empty array', async () => {
    await service.replaceSections('t1', []);

    expect(tx.ecommerceSection.deleteMany).toHaveBeenCalledWith({ where: { storeId: 'store-1' } });
    expect(tx.ecommerceSection.createMany).not.toHaveBeenCalled();
  });

  it('respects an explicit enabled: false', async () => {
    await service.replaceSections('t1', [{ type: 'BANNER', sortOrder: 0, enabled: false }] as any);

    expect(tx.ecommerceSection.createMany.mock.calls[0][0].data[0].enabled).toBe(false);
  });
});
