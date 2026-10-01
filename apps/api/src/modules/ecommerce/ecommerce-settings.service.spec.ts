import { EcommerceSettingsService } from './ecommerce-settings.service';

describe('EcommerceSettingsService', () => {
  let service: EcommerceSettingsService;
  let prisma: any;
  let storeService: any;

  const store = { id: 'store-1', tenantId: 't1', branchIds: [] };

  beforeEach(() => {
    prisma = {
      client: {
        ecommerceStoreSettings: { update: jest.fn() },
        ecommerceStore: { update: jest.fn() },
      },
    };
    storeService = { getOrCreate: jest.fn().mockResolvedValue(store) };
    service = new EcommerceSettingsService(prisma, storeService);
  });

  describe('updateTheme', () => {
    it('updates the settings row keyed by storeId', async () => {
      await service.updateTheme('t1', { primaryColor: '#ff0000' } as any);

      expect(prisma.client.ecommerceStoreSettings.update).toHaveBeenCalledWith({
        where: { storeId: 'store-1' },
        data: { primaryColor: '#ff0000' },
      });
    });

    it('returns the refreshed assembled store', async () => {
      const result = await service.updateTheme('t1', {} as any);
      expect(storeService.getOrCreate).toHaveBeenCalledTimes(2);
      expect(result).toBe(store);
    });
  });

  describe('updateLocation', () => {
    it('updates locationSource on the store', async () => {
      await service.updateLocation('t1', { locationSource: 'STOREFRONT' } as any);

      expect(prisma.client.ecommerceStore.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: { locationSource: 'STOREFRONT' },
      });
    });
  });

  describe('updateFulfillment', () => {
    it('updates fulfillmentOptions on the store', async () => {
      await service.updateFulfillment('t1', { fulfillmentOptions: ['PICKUP', 'SHIPPING'] } as any);

      expect(prisma.client.ecommerceStore.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: { fulfillmentOptions: ['PICKUP', 'SHIPPING'] },
      });
    });
  });
});
