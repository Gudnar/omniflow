import { StorefrontService } from './storefront.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('StorefrontService', () => {
  let service: StorefrontService;
  let prisma: any;
  let tenantContext: any;
  let storeService: any;
  let sessionsService: any;
  let cartsService: any;
  let addressesService: any;
  let contactCommerceService: any;
  let paymentMethodsService: any;
  let storageService: any;

  beforeEach(() => {
    prisma = {
      raw: {
        ecommerceStore: { findUnique: jest.fn() },
        commerceSession: { findUnique: jest.fn() },
      },
      client: {
        ecommerceStoreBranch: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
        branchProduct: { findMany: jest.fn() },
        product: { findUnique: jest.fn() },
        metaConnection: { findUnique: jest.fn() },
        conversation: { findUnique: jest.fn() },
        branch: { findUnique: jest.fn() },
      },
    };
    tenantContext = { setContext: jest.fn() };
    storeService = { getOrCreate: jest.fn() };
    sessionsService = { findOne: jest.fn(), getOrCreateCart: jest.fn(), recordLocation: jest.fn(), setNearestBranch: jest.fn() };
    cartsService = { addItem: jest.fn(), updateItem: jest.fn(), removeItem: jest.fn(), checkout: jest.fn() };
    addressesService = { create: jest.fn() };
    contactCommerceService = { listPurchases: jest.fn() };
    paymentMethodsService = { listEnabled: jest.fn(), resolveQrDownload: jest.fn() };
    storageService = { resolveUploadedFilePath: jest.fn() };
    service = new StorefrontService(
      prisma,
      tenantContext,
      storeService,
      sessionsService,
      cartsService,
      addressesService,
      contactCommerceService,
      paymentMethodsService,
      storageService,
    );
  });

  describe('resolveStoreBySlug', () => {
    it('throws NotFoundError when no store matches the slug', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue(null);
      await expect(service.resolveStoreBySlug('missing')).rejects.toThrow(NotFoundError);
      expect(tenantContext.setContext).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the store exists but is not PUBLISHED', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'DRAFT' });
      await expect(service.resolveStoreBySlug('demo')).rejects.toThrow(NotFoundError);
    });

    it('seeds tenant context and returns the store when PUBLISHED', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      const store = await service.resolveStoreBySlug('demo');
      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
      expect(store.id).toBe('s1');
    });
  });

  describe('getStore', () => {
    it('includes whatsappPhone from the tenant\'s WHATSAPP MetaConnection, when connected', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      storeService.getOrCreate.mockResolvedValue({ id: 's1', name: 'Demo' });
      prisma.client.metaConnection.findUnique.mockResolvedValue({ displayName: '59178889999' });

      const result = await service.getStore('demo');

      expect(result.whatsappPhone).toBe('59178889999');
    });

    it('returns whatsappPhone: null when WhatsApp is not connected', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      storeService.getOrCreate.mockResolvedValue({ id: 's1', name: 'Demo' });
      prisma.client.metaConnection.findUnique.mockResolvedValue(null);

      const result = await service.getStore('demo');

      expect(result.whatsappPhone).toBeNull();
    });

    it('counts only linked branches that have both latitude and longitude set', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      storeService.getOrCreate.mockResolvedValue({ id: 's1', name: 'Demo' });
      prisma.client.metaConnection.findUnique.mockResolvedValue(null);
      prisma.client.ecommerceStoreBranch.findMany.mockResolvedValue([
        { branch: { latitude: -16.5, longitude: -68.15 } },
        { branch: { latitude: null, longitude: null } },
        { branch: { latitude: -17.4, longitude: -66.16 } },
      ]);

      const result = await service.getStore('demo');

      expect(result.locatableBranchCount).toBe(2);
    });
  });

  describe('getPaymentMethods', () => {
    it('resolves the tenant from the slug then delegates to PaymentMethodsService.listEnabled', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      paymentMethodsService.listEnabled.mockResolvedValue([{ id: 'pm1', type: 'QR', enabled: true }]);

      const result = await service.getPaymentMethods('demo');

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
      expect(result).toEqual([{ id: 'pm1', type: 'QR', enabled: true }]);
    });
  });

  describe('listProducts', () => {
    it('rejects when the store has no branch configured', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      prisma.client.ecommerceStoreBranch.findFirst.mockResolvedValue(null);
      await expect(service.listProducts('demo')).rejects.toThrow(ValidationError);
    });

    it('lists only AVAILABLE, in-stock branch products for the store default branch', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      prisma.client.ecommerceStoreBranch.findFirst.mockResolvedValue({ branchId: 'b1' });
      prisma.client.branchProduct.findMany.mockResolvedValue([
        { id: 'bp1', price: '10.00', compareAtPrice: null, product: { id: 'p1' }, variant: { id: 'v1' } },
      ]);

      const result = await service.listProducts('demo');

      expect(prisma.client.branchProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: 'b1', status: 'AVAILABLE', stock: { gt: 0 } } }),
      );
      expect(result[0].price).toBe(10);
    });

    it("selects each product's primary image so the storefront grid can render a thumbnail", async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      prisma.client.ecommerceStoreBranch.findFirst.mockResolvedValue({ branchId: 'b1' });
      prisma.client.branchProduct.findMany.mockResolvedValue([]);

      await service.listProducts('demo');

      const [[call]] = prisma.client.branchProduct.findMany.mock.calls;
      expect(call.include.product.select.media).toEqual({
        where: { isPrimary: true },
        take: 1,
        select: { id: true, url: true },
      });
    });

    it('uses the requested branchId when it is actually linked to this store', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      prisma.client.ecommerceStoreBranch.findUnique.mockResolvedValue({ storeId: 's1', branchId: 'b2' });
      prisma.client.branchProduct.findMany.mockResolvedValue([]);

      await service.listProducts('demo', 'b2');

      expect(prisma.client.ecommerceStoreBranch.findUnique).toHaveBeenCalledWith({
        where: { storeId_branchId: { storeId: 's1', branchId: 'b2' } },
      });
      expect(prisma.client.branchProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: 'b2', status: 'AVAILABLE', stock: { gt: 0 } } }),
      );
      expect(prisma.client.ecommerceStoreBranch.findFirst).not.toHaveBeenCalled();
    });

    // IDOR guard: a branchId that isn't actually linked to this store (e.g.
    // belonging to a different tenant's branch) is never trusted — falls
    // back to the store's own default branch instead.
    it('falls back to the default branch when the requested branchId is not linked to this store', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      prisma.client.ecommerceStoreBranch.findUnique.mockResolvedValue(null);
      prisma.client.ecommerceStoreBranch.findFirst.mockResolvedValue({ branchId: 'b1' });
      prisma.client.branchProduct.findMany.mockResolvedValue([]);

      await service.listProducts('demo', 'someone-elses-branch');

      expect(prisma.client.branchProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: 'b1', status: 'AVAILABLE', stock: { gt: 0 } } }),
      );
    });
  });

  describe('getSession', () => {
    it('leaves returnConversationUrl and branch null when the session has neither', async () => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue({
        id: 'sess1',
        tenantId: 't1',
        publicTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      sessionsService.findOne.mockResolvedValue({ id: 'sess1', conversationId: null, branchId: null, cart: null });

      const result = await service.getSession('tok');

      expect(result.returnConversationUrl).toBeNull();
      expect(result.branch).toBeNull();
      expect(prisma.client.conversation.findUnique).not.toHaveBeenCalled();
    });

    // The bug this covers: a customer who arrived via /chat/[token] (a real,
    // identified conversation with its own webchatToken) clicking "Volver a
    // WhatsApp" on the success screen previously opened a generic wa.me link
    // to the BUSINESS's number — never back to their own conversation.
    it('resolves returnConversationUrl from the session\'s conversation webchatToken, when it has one', async () => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue({
        id: 'sess1',
        tenantId: 't1',
        publicTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      sessionsService.findOne.mockResolvedValue({ id: 'sess1', conversationId: 'conv1', branchId: null, cart: null });
      prisma.client.conversation.findUnique.mockResolvedValue({ webchatToken: 'abc123' });

      const result = await service.getSession('tok');

      expect(prisma.client.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        select: { webchatToken: true },
      });
      expect(result.returnConversationUrl).toBe('http://localhost:3000/chat/abc123');
    });

    it('leaves returnConversationUrl null when the conversation has no webchatToken (a real WhatsApp conversation)', async () => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue({
        id: 'sess1',
        tenantId: 't1',
        publicTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      sessionsService.findOne.mockResolvedValue({ id: 'sess1', conversationId: 'conv1', branchId: null, cart: null });
      prisma.client.conversation.findUnique.mockResolvedValue({ webchatToken: null });

      const result = await service.getSession('tok');

      expect(result.returnConversationUrl).toBeNull();
    });

    it('resolves the branch name when the session has a branchId', async () => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue({
        id: 'sess1',
        tenantId: 't1',
        publicTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      sessionsService.findOne.mockResolvedValue({ id: 'sess1', conversationId: null, branchId: 'b1', cart: null });
      prisma.client.branch.findUnique.mockResolvedValue({ id: 'b1', name: 'Sucursal Centro' });

      const result = await service.getSession('tok');

      expect(result.branch).toEqual({ id: 'b1', name: 'Sucursal Centro' });
    });
  });

  describe('getQrDownload', () => {
    it('resolves the tenant from the slug, then the real file path for the payment method', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      paymentMethodsService.resolveQrDownload.mockResolvedValue({ qrImageUrl: 'http://x/uploads/payment-methods/t1/qr.png', label: 'QR Banco' });
      storageService.resolveUploadedFilePath.mockReturnValue('/data/uploads/payment-methods/t1/qr.png');

      const result = await service.getQrDownload('demo', 'pm1');

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
      expect(paymentMethodsService.resolveQrDownload).toHaveBeenCalledWith('pm1');
      expect(result).toEqual({ filePath: '/data/uploads/payment-methods/t1/qr.png', label: 'QR Banco' });
    });

    it('throws NotFoundError when the stored qrImageUrl does not resolve to a real path', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ id: 's1', tenantId: 't1', status: 'PUBLISHED' });
      paymentMethodsService.resolveQrDownload.mockResolvedValue({ qrImageUrl: 'not-a-real-upload', label: 'QR Banco' });
      storageService.resolveUploadedFilePath.mockReturnValue(null);

      await expect(service.getQrDownload('demo', 'pm1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('setNearestBranch', () => {
    // Regression test: CommerceSessionsService.findOne() (which
    // setNearestBranch delegates to internally) has no idea about
    // returnConversationUrl/branch — those are only computed in
    // StorefrontService.getSession(). Returning the raw delegate result
    // silently dropped both fields from the response the frontend reads
    // right after resolving a nearest branch.
    it('resolves the session from the token, delegates to CommerceSessionsService, then re-fetches through getSession for the full enriched shape', async () => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue({
        id: 'sess1',
        tenantId: 't1',
        publicTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      sessionsService.setNearestBranch.mockResolvedValue({ id: 'sess1', branchId: 'b2' });
      sessionsService.findOne.mockResolvedValue({ id: 'sess1', conversationId: null, branchId: 'b2', cart: null });
      prisma.client.branch.findUnique.mockResolvedValue({ id: 'b2', name: 'Sucursal Sur' });

      const result = await service.setNearestBranch('tok', { latitude: -16.5, longitude: -68.15 });

      expect(sessionsService.setNearestBranch).toHaveBeenCalledWith('sess1', { latitude: -16.5, longitude: -68.15 });
      expect(result).toEqual(
        expect.objectContaining({ id: 'sess1', branchId: 'b2', branch: { id: 'b2', name: 'Sucursal Sur' } }),
      );
    });
  });

  describe('resolveSessionByToken', () => {
    it('rejects when the token does not exist', async () => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue(null);
      await expect(service.resolveSessionByToken('tok')).rejects.toThrow(ValidationError);
    });

    it('rejects an expired token', async () => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue({
        id: 'sess1',
        tenantId: 't1',
        publicTokenExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.resolveSessionByToken('tok')).rejects.toThrow(ValidationError);
    });

    it('seeds tenant context for a valid, unexpired token', async () => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue({
        id: 'sess1',
        tenantId: 't1',
        publicTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      const session = await service.resolveSessionByToken('tok');
      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
      expect(session.id).toBe('sess1');
    });
  });

  describe('cart mutations delegate to the existing, unmodified services', () => {
    beforeEach(() => {
      prisma.raw.commerceSession.findUnique.mockResolvedValue({
        id: 'sess1',
        tenantId: 't1',
        contactId: 'c1',
        publicTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      sessionsService.getOrCreateCart.mockResolvedValue({ id: 'cart1' });
    });

    it('addItem resolves the session then the cart then calls CartsService.addItem', async () => {
      await service.addItem('tok', { variantId: 'v1', quantity: 2 } as any);
      expect(sessionsService.getOrCreateCart).toHaveBeenCalledWith('sess1');
      expect(cartsService.addItem).toHaveBeenCalledWith('cart1', { variantId: 'v1', quantity: 2 });
    });

    it('checkout resolves the session then the cart then calls CartsService.checkout', async () => {
      await service.checkout('tok', { fulfillmentType: 'PICKUP' } as any);
      expect(cartsService.checkout).toHaveBeenCalledWith('cart1', { fulfillmentType: 'PICKUP' });
    });

    it('createAddress uses the session\'s contactId, never a client-supplied one', async () => {
      await service.createAddress('tok', { label: 'Casa' } as any);
      expect(addressesService.create).toHaveBeenCalledWith('c1', { label: 'Casa' });
    });

    it('getPurchases resolves the session then delegates to ContactCommerceService.listPurchases with its contactId', async () => {
      contactCommerceService.listPurchases.mockResolvedValue([]);
      await service.getPurchases('tok');
      expect(contactCommerceService.listPurchases).toHaveBeenCalledWith('c1');
    });
  });
});
