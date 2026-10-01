import { FlowsService } from './flows.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('FlowsService', () => {
  let service: FlowsService;
  let prisma: any;
  let tx: any;
  let tenantContext: any;
  let queueService: any;

  beforeEach(() => {
    tx = {
      flow: { update: jest.fn() },
      flowNode: { deleteMany: jest.fn(), createMany: jest.fn() },
      flowEdge: { createMany: jest.fn() },
    };
    prisma = {
      client: {
        flow: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
        flowExecution: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    tenantContext = { getTenantId: jest.fn().mockReturnValue('tenant-1') };
    queueService = { enqueueWorkflowNode: jest.fn() };
    service = new FlowsService(prisma, tenantContext, queueService);
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.flow.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates a DRAFT flow attributed to the acting user', async () => {
      prisma.client.flow.create.mockResolvedValue({ id: 'f1', status: 'DRAFT', createdByUserId: 'u1' });
      const result = await service.create({ name: 'Bienvenida' } as any, 'u1');
      expect(prisma.client.flow.create).toHaveBeenCalledWith({
        data: { name: 'Bienvenida', description: undefined, createdByUserId: 'u1' },
        include: { nodes: true, edges: true },
      });
      expect(result.id).toBe('f1');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.client.flow.findUnique.mockResolvedValue({ id: 'f1', nodes: [], edges: [] });
    });

    it('updates plain fields without touching nodes/edges when they are omitted', async () => {
      await service.update('f1', { status: 'ACTIVE' } as any);
      expect(tx.flow.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { status: 'ACTIVE' } });
      expect(tx.flowNode.deleteMany).not.toHaveBeenCalled();
    });

    it('replaces the whole node/edge set when nodes are provided, remapping clientIds to real ids', async () => {
      await service.update('f1', {
        nodes: [
          { clientId: 'n1', type: 'TRIGGER', subtype: 'EVENT', config: { eventType: 'contact.created' }, positionX: 0, positionY: 0 },
          { clientId: 'n2', type: 'ACTION', subtype: 'ADD_NOTE', config: {}, positionX: 100, positionY: 0 },
        ],
        edges: [{ sourceClientId: 'n1', targetClientId: 'n2' }],
      } as any);

      expect(tx.flowNode.deleteMany).toHaveBeenCalledWith({ where: { flowId: 'f1' } });
      expect(tx.flowNode.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ flowId: 'f1', type: 'TRIGGER', subtype: 'EVENT' }),
          expect.objectContaining({ flowId: 'f1', type: 'ACTION', subtype: 'ADD_NOTE' }),
        ],
      });
      const createdIds = tx.flowNode.createMany.mock.calls[0][0].data.map((n: any) => n.id);
      expect(new Set(createdIds).size).toBe(2);

      expect(tx.flowEdge.createMany).toHaveBeenCalledWith({
        data: [
          {
            flowId: 'f1',
            sourceNodeId: createdIds[0],
            targetNodeId: createdIds[1],
            sourceHandle: null,
          },
        ],
      });
    });

    it('rejects an edge referencing an unknown clientId', async () => {
      await expect(
        service.update('f1', {
          nodes: [{ clientId: 'n1', type: 'TRIGGER', subtype: 'EVENT', config: {}, positionX: 0, positionY: 0 }],
          edges: [{ sourceClientId: 'n1', targetClientId: 'ghost' }],
        } as any),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('testRun', () => {
    it('rejects a flow with no trigger node', async () => {
      prisma.client.flow.findUnique.mockResolvedValue({ id: 'f1', nodes: [], edges: [] });
      await expect(service.testRun('f1', {})).rejects.toThrow(ValidationError);
    });

    it('creates a RUNNING execution and enqueues the node after the trigger', async () => {
      prisma.client.flow.findUnique.mockResolvedValue({
        id: 'f1',
        nodes: [{ id: 'trigger1', type: 'TRIGGER' }],
        edges: [{ id: 'e1', sourceNodeId: 'trigger1', targetNodeId: 'action1' }],
      });
      prisma.client.flowExecution.create.mockResolvedValue({ id: 'exec1' });

      await service.testRun('f1', { contextData: { foo: 'bar' } });

      expect(prisma.client.flowExecution.create).toHaveBeenCalledWith({
        data: { flowId: 'f1', triggerEventType: 'manual', contextData: { foo: 'bar' } },
      });
      expect(queueService.enqueueWorkflowNode).toHaveBeenCalledWith('tenant-1', 'exec1', 'action1');
    });

    it('completes the execution immediately when the trigger has no outgoing edge', async () => {
      prisma.client.flow.findUnique.mockResolvedValue({
        id: 'f1',
        nodes: [{ id: 'trigger1', type: 'TRIGGER' }],
        edges: [],
      });
      prisma.client.flowExecution.create.mockResolvedValue({ id: 'exec1' });

      await service.testRun('f1', {});

      expect(queueService.enqueueWorkflowNode).not.toHaveBeenCalled();
      expect(prisma.client.flowExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec1' },
        data: { status: 'COMPLETED', finishedAt: expect.any(Date) },
      });
    });
  });
});
