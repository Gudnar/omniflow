import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { QueueService } from '../queue/queue.service';
import { CreateFlowDto, UpdateFlowDto, TestRunDto, ListFlowsQueryDto, ListExecutionsQueryDto } from './dto/flow.dto';
import { pickNextEdge } from './flow-execution.helpers';

const FLOW_INCLUDE = { nodes: true, edges: true };

@Injectable()
export class FlowsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private queueService: QueueService,
  ) {}

  async list(query: ListFlowsQueryDto) {
    return this.prisma.client.flow.findMany({
      where: { ...(query.status && { status: query.status }) },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const flow = await this.prisma.client.flow.findUnique({ where: { id }, include: FLOW_INCLUDE });
    if (!flow) throw new NotFoundError('Flow');
    return flow;
  }

  async create(dto: CreateFlowDto, actorUserId: string) {
    return this.prisma.client.flow.create({
      data: { name: dto.name, description: dto.description, createdByUserId: actorUserId },
      include: FLOW_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateFlowDto) {
    await this.findOne(id);

    await this.prisma.client.$transaction(async (tx: any) => {
      await tx.flow.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      // Replace-the-whole-set (same pattern as EcommerceSection/
      // UserScheduleInterval): only touch nodes/edges when the caller sent
      // them, so a plain status toggle doesn't wipe the graph.
      if (dto.nodes) {
        // Deleting nodes cascades to delete their edges (FlowEdge's
        // sourceNodeId/targetNodeId are both onDelete: Cascade).
        await tx.flowNode.deleteMany({ where: { flowId: id } });

        const idMap = new Map(dto.nodes.map((n) => [n.clientId, randomUUID()]));

        await tx.flowNode.createMany({
          data: dto.nodes.map((n) => ({
            id: idMap.get(n.clientId),
            flowId: id,
            type: n.type,
            subtype: n.subtype,
            name: n.name,
            config: n.config,
            positionX: n.positionX,
            positionY: n.positionY,
          })),
        });

        if (dto.edges?.length) {
          for (const e of dto.edges) {
            if (!idMap.has(e.sourceClientId) || !idMap.has(e.targetClientId)) {
              throw new ValidationError(
                `Edge references an unknown node clientId (${e.sourceClientId} -> ${e.targetClientId})`,
              );
            }
          }

          await tx.flowEdge.createMany({
            data: dto.edges.map((e) => ({
              flowId: id,
              sourceNodeId: idMap.get(e.sourceClientId),
              targetNodeId: idMap.get(e.targetClientId),
              sourceHandle: e.sourceHandle ?? null,
            })),
          });
        }
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.flow.delete({ where: { id } });
    return { success: true };
  }

  async testRun(id: string, dto: TestRunDto) {
    const flow = await this.findOne(id);
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) throw new ValidationError('Tenant context is required to run a flow');

    const triggerNode = flow.nodes.find((n: any) => n.type === 'TRIGGER');
    if (!triggerNode) throw new ValidationError('Flow has no trigger node to start from');

    const execution = await this.prisma.client.flowExecution.create({
      data: {
        flowId: id,
        triggerEventType: 'manual',
        contextData: dto.contextData ?? {},
      },
    });

    const nextEdge = pickNextEdge(flow.edges, triggerNode.id);
    if (nextEdge) {
      await this.queueService.enqueueWorkflowNode(tenantId, execution.id, nextEdge.targetNodeId);
    } else {
      await this.prisma.client.flowExecution.update({
        where: { id: execution.id },
        data: { status: 'COMPLETED', finishedAt: new Date() },
      });
    }

    return execution;
  }

  async listExecutions(flowId: string, query: ListExecutionsQueryDto) {
    await this.findOne(flowId);
    return this.prisma.client.flowExecution.findMany({
      where: { flowId, ...(query.status && { status: query.status as any }) },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getExecution(id: string) {
    const execution = await this.prisma.client.flowExecution.findUnique({
      where: { id },
      include: { logs: { orderBy: { startedAt: 'asc' } } },
    });
    if (!execution) throw new NotFoundError('FlowExecution');
    return execution;
  }
}
