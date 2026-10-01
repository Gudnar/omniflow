import { ContactsService } from './contacts.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: any;
  let tx: any;
  let eventsService: any;

  beforeEach(() => {
    tx = {
      contact: { create: jest.fn(), findUnique: jest.fn() },
      contactTag: { createMany: jest.fn() },
    };
    prisma = {
      client: {
        contact: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        tag: { findUnique: jest.fn() },
        contactTag: { create: jest.fn(), deleteMany: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    eventsService = { emit: jest.fn() };
    service = new ContactsService(prisma, eventsService);
  });

  describe('list', () => {
    it('applies status/type/companyId/search filters to the where clause', async () => {
      prisma.client.contact.findMany.mockResolvedValue([]);
      await service.list('tenant-1', {
        status: 'ACTIVE' as any,
        type: 'LEAD' as any,
        companyId: 'c1',
        search: 'María',
      });

      const callArgs = prisma.client.contact.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        type: 'LEAD',
        companyId: 'c1',
        name: { contains: 'María', mode: 'insensitive' },
      });
    });

    it('omits filters that were not provided', async () => {
      prisma.client.contact.findMany.mockResolvedValue([]);
      await service.list('tenant-1', {});
      const callArgs = prisma.client.contact.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({ tenantId: 'tenant-1' });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundError when the contact does not exist', async () => {
      prisma.client.contact.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates the contact without tags when tagIds is omitted', async () => {
      tx.contact.create.mockResolvedValue({ id: 'ct1', name: 'Juan' });
      tx.contact.findUnique.mockResolvedValue({ id: 'ct1', name: 'Juan' });

      await service.create({ name: 'Juan' } as any);

      expect(tx.contact.create).toHaveBeenCalledWith({ data: { name: 'Juan' } });
      expect(tx.contactTag.createMany).not.toHaveBeenCalled();
    });

    it('attaches tags via createMany when tagIds is provided', async () => {
      tx.contact.create.mockResolvedValue({ id: 'ct1', name: 'Juan' });
      tx.contact.findUnique.mockResolvedValue({ id: 'ct1', name: 'Juan' });

      await service.create({ name: 'Juan', tagIds: ['t1', 't2'] } as any);

      expect(tx.contactTag.createMany).toHaveBeenCalledWith({
        data: [
          { contactId: 'ct1', tagId: 't1' },
          { contactId: 'ct1', tagId: 't2' },
        ],
        skipDuplicates: true,
      });
    });

    it('emits contact.created', async () => {
      tx.contact.create.mockResolvedValue({ id: 'ct1', name: 'Juan' });
      tx.contact.findUnique.mockResolvedValue({ id: 'ct1', name: 'Juan' });

      await service.create({ name: 'Juan' } as any);

      expect(eventsService.emit).toHaveBeenCalledWith(
        'contact.created',
        { contactId: 'ct1', name: 'Juan' },
        'ct1',
      );
    });
  });

  describe('attachTag', () => {
    it('throws NotFoundError when the tag does not exist', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'ct1' });
      prisma.client.tag.findUnique.mockResolvedValue(null);
      await expect(service.attachTag('ct1', 'missing-tag')).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when the tag is already attached', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'ct1' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 't1' });
      prisma.client.contactTag.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.attachTag('ct1', 't1')).rejects.toThrow(ConflictError);
    });

    it('emits contact.tag_added on success', async () => {
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'ct1' });
      prisma.client.tag.findUnique.mockResolvedValue({ id: 't1', name: 'VIP' });
      prisma.client.contactTag.create.mockResolvedValue({});
      await service.attachTag('ct1', 't1');
      expect(eventsService.emit).toHaveBeenCalledWith(
        'contact.tag_added',
        { contactId: 'ct1', tagId: 't1', tagName: 'VIP' },
        'ct1',
      );
    });
  });

  describe('detachTag', () => {
    it('uses deleteMany rather than the composite unique key', async () => {
      prisma.client.contactTag.deleteMany.mockResolvedValue({ count: 1 });
      prisma.client.contact.findUnique.mockResolvedValue({ id: 'ct1' });
      await service.detachTag('ct1', 't1');
      expect(prisma.client.contactTag.deleteMany).toHaveBeenCalledWith({
        where: { contactId: 'ct1', tagId: 't1' },
      });
    });
  });
});
