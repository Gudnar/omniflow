import { NotesService } from './notes.service';
import { NotFoundError } from '@omniflow/utils';

describe('NotesService', () => {
  let service: NotesService;
  let prisma: any;
  let contactsService: any;

  beforeEach(() => {
    prisma = {
      client: {
        note: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    contactsService = { findOne: jest.fn().mockResolvedValue({ id: 'ct1' }) };
    service = new NotesService(prisma, contactsService);
  });

  it('verifies the contact exists before listing notes', async () => {
    prisma.client.note.findMany.mockResolvedValue([]);
    await service.list('ct1');
    expect(contactsService.findOne).toHaveBeenCalledWith('ct1');
    expect(prisma.client.note.findMany).toHaveBeenCalledWith({
      where: { contactId: 'ct1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates a note with the given author', async () => {
    prisma.client.note.create.mockResolvedValue({ id: 'n1' });
    await service.create('ct1', 'user-1', { body: 'Called the client' });
    expect(prisma.client.note.create).toHaveBeenCalledWith({
      data: { contactId: 'ct1', authorId: 'user-1', body: 'Called the client' },
    });
  });

  it('throws NotFoundError when updating a note from another contact', async () => {
    prisma.client.note.findFirst.mockResolvedValue(null);
    await expect(service.update('ct1', 'n1', { body: 'x' })).rejects.toThrow(NotFoundError);
    expect(prisma.client.note.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when removing a note from another contact', async () => {
    prisma.client.note.findFirst.mockResolvedValue(null);
    await expect(service.remove('ct1', 'n1')).rejects.toThrow(NotFoundError);
    expect(prisma.client.note.delete).not.toHaveBeenCalled();
  });

  it('removes a note that belongs to the contact', async () => {
    prisma.client.note.findFirst.mockResolvedValue({ id: 'n1', contactId: 'ct1' });
    prisma.client.note.delete.mockResolvedValue({ id: 'n1' });
    await expect(service.remove('ct1', 'n1')).resolves.toEqual({ success: true });
  });
});
