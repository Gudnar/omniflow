import { CartsService } from './carts.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

function decimalCart(overrides: any = {}) {
  return {
    id: 'cart-1',
    contactId: 'c1',
    branchId: 'b1',
    status: 'ACTIVE',
    currency: 'BOB',
    subtotal: '0',
    discount: '0',
    shipping: '0',
    tax: '0',
    total: '0',
    items: [],
    ...overrides,
  };
}

describe('CartsService', () => {
  let service: CartsService;
  let prisma: any;
  let tx: any;
  let eventsService: any;
  let tenantContext: any;
  let notificationsService: any;
  let confirmationImagesService: any;
  let deliveryZonesService: any;
  let deliveryProviderConfigService: any;
  let queueService: any;

  beforeEach(() => {
    tx = {
      branchProduct: { findUnique: jest.fn(), update: jest.fn() },
      order: { create: jest.fn(), findUnique: jest.fn() },
      orderItem: { createMany: jest.fn() },
      cart: { update: jest.fn() },
      fulfillment: { create: jest.fn() },
    };
    prisma = {
      client: {
        cart: { findUnique: jest.fn(), update: jest.fn() },
        cartItem: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        branchProduct: { findUnique: jest.fn() },
        tenant: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ orderApprovalMode: 'AUTOMATIC', notifyOnOrderPendingApproval: true }),
        },
        commerceSession: { findUnique: jest.fn().mockResolvedValue(null) },
        customerAddress: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    eventsService = { emit: jest.fn() };
    tenantContext = { getTenantId: jest.fn().mockReturnValue('t1') };
    notificationsService = { create: jest.fn() };
    confirmationImagesService = { send: jest.fn() };
    deliveryZonesService = { calculateFee: jest.fn().mockResolvedValue({ covered: true, fee: 0 }) };
    deliveryProviderConfigService = { resolveForBranch: jest.fn().mockResolvedValue(null) };
    queueService = { enqueueDeliveryNotifyForOrder: jest.fn() };
    service = new CartsService(
      prisma,
      eventsService,
      tenantContext,
      notificationsService,
      confirmationImagesService,
      deliveryZonesService,
      deliveryProviderConfigService,
      queueService,
    );
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.cart.findUnique.mockResolvedValue(null);
      await expect(service.findOne('cart-1')).rejects.toThrow(NotFoundError);
    });

    it('serializes Decimal fields to plain numbers', async () => {
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ subtotal: '19.99', total: '19.99' }));
      const result = await service.findOne('cart-1');
      expect(result.subtotal).toBe(19.99);
      expect(result.total).toBe(19.99);
    });
  });

  describe('addItem', () => {
    beforeEach(() => {
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart());
    });

    it('rejects adding to a non-ACTIVE cart', async () => {
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ status: 'CHECKED_OUT' }));
      await expect(service.addItem('cart-1', { variantId: 'v1', quantity: 1 } as any)).rejects.toThrow(ValidationError);
    });

    it('rejects when the cart has no branch selected', async () => {
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ branchId: null }));
      await expect(service.addItem('cart-1', { variantId: 'v1', quantity: 1 } as any)).rejects.toThrow(ValidationError);
    });

    it('rejects when the variant has no available BranchProduct at this branch', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue(null);
      await expect(service.addItem('cart-1', { variantId: 'v1', quantity: 1 } as any)).rejects.toThrow(ValidationError);
    });

    it('computes the price from BranchProduct, never from the client', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        productId: 'p1',
        price: '25.00',
        status: 'AVAILABLE',
      });
      prisma.client.cartItem.findUnique.mockResolvedValue(null);
      prisma.client.cartItem.findMany.mockResolvedValue([]);

      await service.addItem('cart-1', { variantId: 'v1', quantity: 2, price: 0.01 } as any);

      expect(prisma.client.cartItem.create).toHaveBeenCalledWith({
        data: { cartId: 'cart-1', productId: 'p1', variantId: 'v1', quantity: 2, unitPrice: 25, subtotal: 50 },
      });
    });

    it('increments quantity instead of duplicating when the variant is already in the cart', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue({ productId: 'p1', price: '25.00', status: 'AVAILABLE' });
      prisma.client.cartItem.findUnique.mockResolvedValue({ id: 'ci1', quantity: 2, discount: '0' });
      prisma.client.cartItem.findMany.mockResolvedValue([]);

      await service.addItem('cart-1', { variantId: 'v1', quantity: 3 } as any);

      expect(prisma.client.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'ci1' },
        data: { quantity: 5, unitPrice: 25, subtotal: 125 },
      });
      expect(prisma.client.cartItem.create).not.toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('flags and corrects a stale price without throwing', async () => {
      const item = { id: 'ci1', variantId: 'v1', unitPrice: 25, discount: 0, quantity: 2 };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item] }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '30.00',
        status: 'AVAILABLE',
        stock: 100,
        reservedStock: 0,
      });
      prisma.client.cartItem.findMany.mockResolvedValue([{ ...item, subtotal: '60' }]);

      const result = await service.validate('cart-1');

      expect(prisma.client.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'ci1' },
        data: { unitPrice: 30, subtotal: 60 },
      });
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'PRICE_CHANGED' })]),
      );
    });

    it('flags insufficient stock without throwing', async () => {
      const item = { id: 'ci1', variantId: 'v1', unitPrice: 25, discount: 0, quantity: 10 };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item] }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '25.00',
        status: 'AVAILABLE',
        stock: 5,
        reservedStock: 0,
      });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);

      const result = await service.validate('cart-1');

      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'INSUFFICIENT_STOCK' })]),
      );
    });

    it('reports no issues for a healthy cart', async () => {
      const item = { id: 'ci1', variantId: 'v1', unitPrice: 25, discount: 0, quantity: 2 };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item] }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '25.00',
        status: 'AVAILABLE',
        stock: 100,
        reservedStock: 0,
      });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);

      const result = await service.validate('cart-1');
      expect(result.issues).toEqual([]);
    });
  });

  describe('checkout', () => {
    it('rejects checkout on a non-ACTIVE cart', async () => {
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ status: 'CHECKED_OUT', items: [{}] }));
      await expect(service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any)).rejects.toThrow(ValidationError);
    });

    it('rejects checkout on an empty cart', async () => {
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [] }));
      await expect(service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any)).rejects.toThrow(ValidationError);
    });

    it('requires addressId for non-PICKUP fulfillment', async () => {
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [{ id: 'ci1' }] }));
      await expect(
        service.checkout('cart-1', { fulfillmentType: 'LOCAL_DELIVERY' } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects LOCAL_DELIVERY checkout when the address is out of zone coverage', async () => {
      const item = { id: 'ci1', variantId: 'v1', unitPrice: 25, discount: 0, quantity: 1 };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item] }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '25.00',
        status: 'AVAILABLE',
        stock: 100,
        reservedStock: 0,
      });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      deliveryZonesService.calculateFee.mockResolvedValue({ covered: false });

      await expect(
        service.checkout('cart-1', { fulfillmentType: 'LOCAL_DELIVERY', addressId: 'addr-1' } as any),
      ).rejects.toThrow(ValidationError);
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it('uses the recalculated zone fee as shipping (and in the order total), never the stale cart value', async () => {
      const item = {
        id: 'ci1',
        variantId: 'v1',
        productId: 'p1',
        unitPrice: 25,
        discount: 0,
        subtotal: 25,
        quantity: 1,
        product: { id: 'p1', name: 'Camiseta' },
        variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(
        decimalCart({ items: [item], subtotal: '25', shipping: '0', total: '25' }),
      );
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '25.00',
        status: 'AVAILABLE',
        stock: 100,
        reservedStock: 0,
      });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      prisma.client.customerAddress.findUnique.mockResolvedValue({ zone: 'centro', latitude: null, longitude: null });
      deliveryZonesService.calculateFee.mockResolvedValue({ covered: true, fee: 15 });
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({ id: 'order-1', items: [] });

      await service.checkout('cart-1', { fulfillmentType: 'LOCAL_DELIVERY', addressId: 'addr-1' } as any);

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ shipping: 15, total: 40 }) }),
      );
    });

    it('throws and creates nothing when validation finds a blocking issue', async () => {
      const item = { id: 'ci1', variantId: 'v1', unitPrice: 25, discount: 0, quantity: 10 };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item] }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '25.00',
        status: 'AVAILABLE',
        stock: 1,
        reservedStock: 0,
      });

      await expect(service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any)).rejects.toThrow(ValidationError);
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it('on success: reserves stock, creates Order+OrderItems, and marks the cart CHECKED_OUT', async () => {
      const item = {
        id: 'ci1',
        variantId: 'v1',
        productId: 'p1',
        unitPrice: 25,
        discount: 0,
        subtotal: 50,
        quantity: 2,
        product: { id: 'p1', name: 'Camiseta' },
        variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(
        decimalCart({ items: [item], subtotal: '50', total: '50' }),
      );
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '25.00',
        status: 'AVAILABLE',
        stock: 100,
        reservedStock: 0,
      });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({
        id: 'order-1',
        contactId: 'c1',
        orderNumber: 'ORD-1',
        items: [],
        subtotal: '50',
        discount: '0',
        shipping: '0',
        tax: '0',
        total: '50',
      });

      const result = await service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any);

      expect(deliveryProviderConfigService.resolveForBranch).not.toHaveBeenCalled();
      expect(tx.branchProduct.update).toHaveBeenCalledWith({ where: { id: 'bp1' }, data: { reservedStock: 2 } });
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'c1',
            cartId: 'cart-1',
            fulfillmentType: 'PICKUP',
            status: 'CONFIRMED',
            confirmedAt: expect.any(Date),
            customerLocation: null,
          }),
        }),
      );
      expect(tx.fulfillment.create).toHaveBeenCalledWith({
        data: { orderId: 'order-1', type: 'PICKUP', branchId: 'b1', addressId: undefined, status: 'PENDING' },
      });
      expect(tx.orderItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            orderId: 'order-1',
            productNameSnapshot: 'Camiseta',
            skuSnapshot: 'CAM-M',
            quantity: 2,
          }),
        ],
      });
      expect(tx.cart.update).toHaveBeenCalledWith({ where: { id: 'cart-1' }, data: { status: 'CHECKED_OUT' } });
      expect(result.id).toBe('order-1');
      expect(eventsService.emit).toHaveBeenCalledWith(
        'order.created',
        { orderId: 'order-1', orderNumber: 'ORD-1', total: 50, productIds: [], productNames: [] },
        'c1',
      );
    });

    it('enqueues a Telegram notify on auto-confirm checkout when the branch is LOCAL_DELIVERY + TELEGRAM_NOTIFY + IMMEDIATE', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 25, discount: 0, subtotal: 50, quantity: 2,
        product: { id: 'p1', name: 'Camiseta' }, variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item], subtotal: '50', total: '50' }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '25.00', status: 'AVAILABLE', stock: 100, reservedStock: 0,
      });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({
        id: 'order-1', contactId: 'c1', orderNumber: 'ORD-1', branchId: 'b1', fulfillmentType: 'LOCAL_DELIVERY',
        items: [], subtotal: '50', discount: '0', shipping: '0', tax: '0', total: '50',
      });
      deliveryProviderConfigService.resolveForBranch.mockResolvedValue({ type: 'TELEGRAM_NOTIFY', operationMode: 'IMMEDIATE' });

      await service.checkout('cart-1', { fulfillmentType: 'LOCAL_DELIVERY', addressId: 'addr-1' } as any);

      expect(deliveryProviderConfigService.resolveForBranch).toHaveBeenCalledWith('t1', 'b1');
      expect(queueService.enqueueDeliveryNotifyForOrder).toHaveBeenCalledWith('t1', 'order-1');
    });

    it('does not enqueue anything when the order requires manual approval, even if the branch is IMMEDIATE', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 25, discount: 0, subtotal: 50, quantity: 2,
        product: { id: 'p1', name: 'Camiseta' }, variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.tenant.findUnique.mockResolvedValue({ orderApprovalMode: 'MANUAL' });
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item], subtotal: '50', total: '50' }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({
        price: '25.00', status: 'AVAILABLE', stock: 100, reservedStock: 0,
      });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({
        id: 'order-1', contactId: 'c1', orderNumber: 'ORD-1', branchId: 'b1', fulfillmentType: 'LOCAL_DELIVERY',
        items: [], subtotal: '50', discount: '0', shipping: '0', tax: '0', total: '50',
      });
      deliveryProviderConfigService.resolveForBranch.mockResolvedValue({ type: 'TELEGRAM_NOTIFY', operationMode: 'IMMEDIATE' });

      await service.checkout('cart-1', { fulfillmentType: 'LOCAL_DELIVERY', addressId: 'addr-1' } as any);

      expect(queueService.enqueueDeliveryNotifyForOrder).not.toHaveBeenCalled();
    });

    it('sends confirmation images when the cart has a commerceSessionId with a conversation and the tenant has them enabled', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 25, discount: 0, subtotal: 50, quantity: 2,
        product: { id: 'p1', name: 'Camiseta' }, variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(
        decimalCart({ items: [item], subtotal: '50', total: '50', commerceSessionId: 'sess-1' }),
      );
      prisma.client.branchProduct.findUnique.mockResolvedValue({ price: '25.00', status: 'AVAILABLE', stock: 100, reservedStock: 0 });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      prisma.client.tenant.findUnique.mockResolvedValue({
        name: 'Demo Co',
        orderApprovalMode: 'AUTOMATIC',
        notifyOnOrderPendingApproval: true,
        sendOrderQrCode: true,
        sendOrderReceiptImage: true,
      });
      prisma.client.commerceSession.findUnique.mockResolvedValue({ metadata: {}, conversationId: 'conv1' });
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({
        id: 'order-1',
        contactId: 'c1',
        orderNumber: 'ORD-1',
        currency: 'BOB',
        createdAt: new Date('2026-01-05T09:00:00.000Z'),
        items: [{ productNameSnapshot: 'Camiseta', quantity: 2, subtotal: '50' }],
        subtotal: '50',
        discount: '0',
        shipping: '0',
        tax: '0',
        total: '50',
      });

      await service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any);

      expect(confirmationImagesService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          conversationId: 'conv1',
          sendQrCode: true,
          sendReceiptImage: true,
        }),
      );
    });

    it('snapshots the preparation fields onto OrderItem and includes the notice in the image receipt for PICKUP', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 30, discount: 0, subtotal: 30, quantity: 1,
        product: { id: 'p1', name: 'Helado de vainilla', requiresPreparation: true, preparationReason: 'Requiere congelación', preparationMinutes: 20 },
        variant: { id: 'v1', sku: 'HEL-V' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(
        decimalCart({ items: [item], subtotal: '30', total: '30', commerceSessionId: 'sess-1' }),
      );
      prisma.client.branchProduct.findUnique.mockResolvedValue({ price: '30.00', status: 'AVAILABLE', stock: 100, reservedStock: 0 });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      prisma.client.tenant.findUnique.mockResolvedValue({
        name: 'Demo Co',
        orderApprovalMode: 'AUTOMATIC',
        notifyOnOrderPendingApproval: true,
        sendOrderQrCode: true,
        sendOrderReceiptImage: true,
      });
      prisma.client.commerceSession.findUnique.mockResolvedValue({ metadata: {}, conversationId: 'conv1' });
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({
        id: 'order-1',
        contactId: 'c1',
        orderNumber: 'ORD-1',
        currency: 'BOB',
        fulfillmentType: 'PICKUP',
        createdAt: new Date('2026-01-05T09:00:00.000Z'),
        items: [{
          productNameSnapshot: 'Helado de vainilla', quantity: 1, subtotal: '30',
          requiresPreparationSnapshot: true, preparationReasonSnapshot: 'Requiere congelación', preparationMinutesSnapshot: 20,
        }],
        subtotal: '30', discount: '0', shipping: '0', tax: '0', total: '30',
      });

      await service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any);

      expect(tx.orderItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            requiresPreparationSnapshot: true,
            preparationReasonSnapshot: 'Requiere congelación',
            preparationMinutesSnapshot: 20,
          }),
        ],
      });
      expect(confirmationImagesService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          receipt: expect.objectContaining({
            lines: expect.arrayContaining([{ label: '⏱️ Preparación necesaria', value: '~20 min' }]),
          }),
        }),
      );
    });

    it('creates the order PENDING (no confirmedAt) when the tenant requires manual approval', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 25, discount: 0, subtotal: 50, quantity: 2,
        product: { id: 'p1', name: 'Camiseta' }, variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item], subtotal: '50', total: '50' }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({ price: '25.00', status: 'AVAILABLE', stock: 100, reservedStock: 0 });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      prisma.client.tenant.findUnique.mockResolvedValue({
        orderApprovalMode: 'MANUAL',
        notifyOnOrderPendingApproval: true,
      });
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({ id: 'order-1', contactId: 'c1', orderNumber: 'ORD-1', items: [], subtotal: '50', discount: '0', shipping: '0', tax: '0', total: '50' });

      await service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any);

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', confirmedAt: null }) }),
      );
      expect(eventsService.emit).toHaveBeenCalledWith(
        'order.pending_approval',
        { orderId: 'order-1', orderNumber: 'ORD-1', total: 50, productIds: [], productNames: [] },
        'c1',
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'order.pending_approval', link: '/dashboard/orders' }),
      );
    });

    it('skips the in-app notification when the tenant disabled it, but still emits the event', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 25, discount: 0, subtotal: 50, quantity: 2,
        product: { id: 'p1', name: 'Camiseta' }, variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item], subtotal: '50', total: '50' }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({ price: '25.00', status: 'AVAILABLE', stock: 100, reservedStock: 0 });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      prisma.client.tenant.findUnique.mockResolvedValue({
        orderApprovalMode: 'MANUAL',
        notifyOnOrderPendingApproval: false,
      });
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({ id: 'order-1', contactId: 'c1', orderNumber: 'ORD-1', items: [], subtotal: '50', discount: '0', shipping: '0', tax: '0', total: '50' });

      await service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any);

      expect(eventsService.emit).toHaveBeenCalledWith(
        'order.pending_approval',
        expect.anything(),
        'c1',
      );
      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('notifies the in-app bell when an order confirms automatically and the tenant opted in', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 25, discount: 0, subtotal: 50, quantity: 2,
        product: { id: 'p1', name: 'Camiseta' }, variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item], subtotal: '50', total: '50' }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({ price: '25.00', status: 'AVAILABLE', stock: 100, reservedStock: 0 });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      prisma.client.tenant.findUnique.mockResolvedValue({
        orderApprovalMode: 'AUTOMATIC',
        notifyOnOrderConfirmed: true,
      });
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({ id: 'order-1', contactId: 'c1', orderNumber: 'ORD-1', items: [], subtotal: '50', discount: '0', shipping: '0', tax: '0', total: '50' });

      await service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'order.confirmed', link: '/dashboard/orders' }),
      );
    });

    it('does not notify on automatic confirmation when the tenant has not opted in', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 25, discount: 0, subtotal: 50, quantity: 2,
        product: { id: 'p1', name: 'Camiseta' }, variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(decimalCart({ items: [item], subtotal: '50', total: '50' }));
      prisma.client.branchProduct.findUnique.mockResolvedValue({ price: '25.00', status: 'AVAILABLE', stock: 100, reservedStock: 0 });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      prisma.client.tenant.findUnique.mockResolvedValue({
        orderApprovalMode: 'AUTOMATIC',
        notifyOnOrderConfirmed: false,
      });
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({ id: 'order-1', contactId: 'c1', orderNumber: 'ORD-1', items: [], subtotal: '50', discount: '0', shipping: '0', tax: '0', total: '50' });

      await service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('snapshots the session\'s captured GPS location onto the order when the cart is linked to one', async () => {
      const item = {
        id: 'ci1', variantId: 'v1', productId: 'p1', unitPrice: 25, discount: 0, subtotal: 50, quantity: 2,
        product: { id: 'p1', name: 'Camiseta' }, variant: { id: 'v1', sku: 'CAM-M' },
      };
      prisma.client.cart.findUnique.mockResolvedValue(
        decimalCart({ items: [item], subtotal: '50', total: '50', commerceSessionId: 'sess-1' }),
      );
      prisma.client.branchProduct.findUnique.mockResolvedValue({ price: '25.00', status: 'AVAILABLE', stock: 100, reservedStock: 0 });
      prisma.client.cartItem.findMany.mockResolvedValue([item]);
      prisma.client.commerceSession.findUnique.mockResolvedValue({
        metadata: { location: { latitude: -16.5, longitude: -68.1 } },
      });
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', reservedStock: 0 });
      tx.order.create.mockResolvedValue({ id: 'order-1' });
      tx.order.findUnique.mockResolvedValue({ id: 'order-1', contactId: 'c1', orderNumber: 'ORD-1', items: [], subtotal: '50', discount: '0', shipping: '0', tax: '0', total: '50' });

      await service.checkout('cart-1', { fulfillmentType: 'PICKUP' } as any);

      expect(prisma.client.commerceSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'sess-1' },
        select: { metadata: true, conversationId: true },
      });
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerLocation: { latitude: -16.5, longitude: -68.1 } }),
        }),
      );
    });
  });
});
