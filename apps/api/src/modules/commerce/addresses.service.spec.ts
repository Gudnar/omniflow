import { AddressesService } from './addresses.service';
import { NotFoundError } from '@omniflow/utils';

describe('AddressesService', () => {
  let service: AddressesService;
  let prisma: any;
  let contactsService: any;

  beforeEach(() => {
    prisma = {
      client: {
        customerAddress: {
          findMany: jest.fn(),
          create: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    contactsService = { findOne: jest.fn().mockResolvedValue({ id: 'c1' }) };
    service = new AddressesService(prisma, contactsService);
  });

  describe('list', () => {
    it('verifies the contact exists and orders default-first', async () => {
      prisma.client.customerAddress.findMany.mockResolvedValue([]);
      await service.list('c1');
      expect(contactsService.findOne).toHaveBeenCalledWith('c1');
      expect(prisma.client.customerAddress.findMany).toHaveBeenCalledWith({
        where: { contactId: 'c1' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('create', () => {
    it('unsets any previous default when creating a new default address', async () => {
      prisma.client.customerAddress.create.mockResolvedValue({ id: 'a1' });
      await service.create('c1', { isDefault: true } as any);
      expect(prisma.client.customerAddress.updateMany).toHaveBeenCalledWith({
        where: { contactId: 'c1' },
        data: { isDefault: false },
      });
    });

    it('does not touch other addresses when not default', async () => {
      prisma.client.customerAddress.create.mockResolvedValue({ id: 'a1' });
      await service.create('c1', {} as any);
      expect(prisma.client.customerAddress.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundError when the address does not belong to the contact', async () => {
      prisma.client.customerAddress.findFirst.mockResolvedValue(null);
      await expect(service.update('c1', 'a1', {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes an existing address', async () => {
      prisma.client.customerAddress.findFirst.mockResolvedValue({ id: 'a1', contactId: 'c1' });
      const result = await service.remove('c1', 'a1');
      expect(prisma.client.customerAddress.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
      expect(result).toEqual({ success: true });
    });
  });
});
