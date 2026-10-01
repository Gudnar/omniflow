import { AiAgentsService } from './ai-agents.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('AiAgentsService', () => {
  let service: AiAgentsService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      aiAgent: { create: jest.fn(), update: jest.fn() },
      aiAgentKnowledgeDocument: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    prisma = {
      client: {
        aiAgent: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    service = new AiAgentsService(prisma);
  });

  describe('create', () => {
    it('creates an INACTIVE agent without checking for channel conflicts', async () => {
      const dto = { name: 'Bot', modelId: 'm1', channels: ['WHATSAPP'] } as any;
      tx.aiAgent.create.mockResolvedValue({ id: 'a1' });
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1', ...dto, status: 'INACTIVE' });

      await service.create(dto);

      expect(prisma.client.aiAgent.findMany).not.toHaveBeenCalled();
      expect(tx.aiAgent.create).toHaveBeenCalledWith({ data: dto });
      expect(tx.aiAgentKnowledgeDocument.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects creating an ACTIVE agent when another ACTIVE agent already claims the channel', async () => {
      const dto = { name: 'Bot', modelId: 'm1', channels: ['WHATSAPP'], status: 'ACTIVE' } as any;
      prisma.client.aiAgent.findMany.mockResolvedValue([{ id: 'existing', name: 'Existing Bot', channels: ['WHATSAPP'] }]);

      await expect(service.create(dto)).rejects.toThrow(ValidationError);
      expect(tx.aiAgent.create).not.toHaveBeenCalled();
    });

    it('allows creating an ACTIVE agent when no other ACTIVE agent claims the channel', async () => {
      const dto = { name: 'Bot', modelId: 'm1', channels: ['WHATSAPP'], status: 'ACTIVE' } as any;
      prisma.client.aiAgent.findMany.mockResolvedValue([]);
      tx.aiAgent.create.mockResolvedValue({ id: 'a1' });
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1', ...dto });

      await service.create(dto);

      expect(tx.aiAgent.create).toHaveBeenCalled();
    });

    it('links the given knowledge document ids to the new agent', async () => {
      const dto = { name: 'Bot', modelId: 'm1', channels: ['WHATSAPP'], knowledgeDocumentIds: ['doc1', 'doc2'] } as any;
      tx.aiAgent.create.mockResolvedValue({ id: 'a1' });
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1' });

      await service.create(dto);

      expect(tx.aiAgent.create).toHaveBeenCalledWith({
        data: { name: 'Bot', modelId: 'm1', channels: ['WHATSAPP'] },
      });
      expect(tx.aiAgentKnowledgeDocument.deleteMany).toHaveBeenCalledWith({ where: { agentId: 'a1' } });
      expect(tx.aiAgentKnowledgeDocument.createMany).toHaveBeenCalledWith({
        data: [{ agentId: 'a1', documentId: 'doc1' }, { agentId: 'a1', documentId: 'doc2' }],
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundError when the agent does not exist', async () => {
      prisma.client.aiAgent.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' } as any)).rejects.toThrow(NotFoundError);
    });

    it('rejects activating an agent onto a channel another ACTIVE agent already owns', async () => {
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1', status: 'INACTIVE', channels: ['WHATSAPP'] });
      prisma.client.aiAgent.findMany.mockResolvedValue([{ id: 'a2', name: 'Other Bot', channels: ['WHATSAPP'] }]);

      await expect(service.update('a1', { status: 'ACTIVE' } as any)).rejects.toThrow(ValidationError);
    });

    it('excludes the agent itself from the conflict check', async () => {
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1', status: 'ACTIVE', channels: ['WHATSAPP'] });
      prisma.client.aiAgent.findMany.mockResolvedValue([]);
      tx.aiAgent.update.mockResolvedValue({ id: 'a1' });

      await service.update('a1', { name: 'Renamed' } as any);

      expect(prisma.client.aiAgent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { not: 'a1' } }) }),
      );
    });

    it('does not touch knowledge document links when knowledgeDocumentIds is omitted', async () => {
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1', status: 'ACTIVE', channels: ['WHATSAPP'] });
      prisma.client.aiAgent.findMany.mockResolvedValue([]);

      await service.update('a1', { name: 'Renamed' } as any);

      expect(tx.aiAgentKnowledgeDocument.deleteMany).not.toHaveBeenCalled();
    });

    it('replaces knowledge document links when knowledgeDocumentIds is provided', async () => {
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1', status: 'ACTIVE', channels: ['WHATSAPP'] });
      prisma.client.aiAgent.findMany.mockResolvedValue([]);

      await service.update('a1', { knowledgeDocumentIds: ['doc1'] } as any);

      expect(tx.aiAgentKnowledgeDocument.deleteMany).toHaveBeenCalledWith({ where: { agentId: 'a1' } });
      expect(tx.aiAgentKnowledgeDocument.createMany).toHaveBeenCalledWith({
        data: [{ agentId: 'a1', documentId: 'doc1' }],
      });
    });

    it('clears knowledge document links when an empty array is provided', async () => {
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1', status: 'ACTIVE', channels: ['WHATSAPP'] });
      prisma.client.aiAgent.findMany.mockResolvedValue([]);

      await service.update('a1', { knowledgeDocumentIds: [] } as any);

      expect(tx.aiAgentKnowledgeDocument.deleteMany).toHaveBeenCalledWith({ where: { agentId: 'a1' } });
      expect(tx.aiAgentKnowledgeDocument.createMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundError when the agent does not exist', async () => {
      prisma.client.aiAgent.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundError);
    });

    it('removes an existing agent', async () => {
      prisma.client.aiAgent.findUnique.mockResolvedValue({ id: 'a1' });
      await expect(service.remove('a1')).resolves.toEqual({ success: true });
    });
  });
});
