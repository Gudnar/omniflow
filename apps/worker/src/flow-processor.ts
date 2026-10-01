import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';

/**
 * Phase 16: Workflows — the graph-execution engine. Runs entirely outside
 * the API's NestJS DI/CLS context (same rationale as
 * whatsapp-outbound-processor.ts), so it uses the raw (unscoped) prisma
 * client and filters by tenantId manually. Complex domain mutations (order/
 * appointment status transitions, message sending, tag/note/assignment
 * writes) are NOT reimplemented here — they're delegated to the API's
 * shared-secret-protected /internal/flows/actions/* surface so the real,
 * validated NestJS services run them.
 *
 * These helpers mirror apps/api/src/modules/workflows/flow-execution.helpers.ts
 * — duplicated rather than shared across the two apps, same as this app
 * already duplicates raw-prisma tenant filtering instead of importing
 * NestJS-bound services.
 */

function getByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function evaluateCondition(config: any, contextData: any): boolean {
  const actual = getByPath(contextData, config.field);
  switch (config.operator) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'eq':
      return actual === config.value;
    case 'neq':
      return actual !== config.value;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(config.value);
      if (typeof actual === 'string') return actual.includes(String(config.value));
      return false;
    case 'gt':
      return Number(actual) > Number(config.value);
    case 'lt':
      return Number(actual) < Number(config.value);
    default:
      return false;
  }
}

function pickNextEdge(edges: any[], nodeId: string, handle?: 'true' | 'false') {
  const outgoing = edges.filter((e) => e.sourceNodeId === nodeId);
  if (handle) return outgoing.find((e) => e.sourceHandle === handle);
  return outgoing[0];
}

function interpolate(template: string, contextData: any): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path) => {
    const value = getByPath(contextData, path);
    return value === undefined || value === null ? '' : String(value);
  });
}

function resolveConfig(config: Record<string, any>, contextData: any): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(config ?? {})) {
    resolved[key] = typeof value === 'string' ? interpolate(value, contextData) : value;
  }
  return resolved;
}

export interface WorkflowJobData {
  kind: 'event' | 'node';
  tenantId: string;
  eventType?: string;
  payload?: Record<string, any>;
  eventId?: string;
  executionId?: string;
  nodeId?: string;
}

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';
const INTERNAL_SECRET = process.env.WORKER_INTERNAL_SECRET || 'dev-internal-secret';

export function createFlowProcessor(connection: Redis) {
  const workflowsQueue = new Queue('workflows', { connection });

  async function enqueueNode(tenantId: string, executionId: string, nodeId: string, delayMs?: number) {
    await workflowsQueue.add(
      'node',
      { kind: 'node', tenantId, executionId, nodeId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 1000,
        ...(delayMs ? { delay: delayMs } : {}),
      },
    );
  }

  async function handleEvent(data: WorkflowJobData) {
    const { tenantId, eventType, payload = {} } = data;

    const flows = await prisma.flow.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { nodes: true, edges: true },
    });

    const matches = flows.filter((flow) =>
      flow.nodes.some(
        (n) => n.type === 'TRIGGER' && n.subtype === 'EVENT' && (n.config as any)?.eventType === eventType,
      ),
    );

    if (!matches.length) return;

    let contact: any = undefined;
    if (payload.contactId) {
      contact = await prisma.contact.findUnique({
        where: { id: payload.contactId },
        include: { tags: { include: { tag: true } } },
      });
    }

    for (const flow of matches) {
      const triggerNode = flow.nodes.find(
        (n) => n.type === 'TRIGGER' && n.subtype === 'EVENT' && (n.config as any)?.eventType === eventType,
      )!;

      const execution = await prisma.flowExecution.create({
        data: {
          tenantId,
          flowId: flow.id,
          triggerEventType: eventType,
          contextData: { event: { type: eventType, payload }, contact },
        },
      });

      const nextEdge = pickNextEdge(flow.edges, triggerNode.id);
      if (nextEdge) {
        await enqueueNode(tenantId, execution.id, nextEdge.targetNodeId);
      } else {
        await prisma.flowExecution.update({
          where: { id: execution.id },
          data: { status: 'COMPLETED', finishedAt: new Date() },
        });
      }
    }
  }

  async function callInternalAction(path: string, body: Record<string, any>): Promise<void> {
    const response = await fetch(`${API_INTERNAL_URL}/internal/flows/actions/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Internal action ${path} failed: ${response.status} ${text}`);
    }
  }

  async function handleNode(data: WorkflowJobData) {
    const { tenantId, executionId, nodeId } = data as Required<Pick<WorkflowJobData, 'tenantId' | 'executionId' | 'nodeId'>>;

    const execution = await prisma.flowExecution.findUnique({ where: { id: executionId } });
    if (!execution || execution.tenantId !== tenantId) return;
    if (execution.status === 'CANCELLED' || execution.status === 'FAILED') return;

    const node = await prisma.flowNode.findUnique({ where: { id: nodeId } });
    if (!node || node.tenantId !== tenantId) return;

    const flowEdges = await prisma.flowEdge.findMany({ where: { flowId: node.flowId } });
    const contextData = execution.contextData as any;

    const logStart = { tenantId, executionId, nodeId, status: 'SUCCESS' as const, startedAt: new Date() };

    const advance = async (handle?: 'true' | 'false') => {
      const nextEdge = pickNextEdge(flowEdges, nodeId, handle);
      if (nextEdge) {
        await enqueueNode(tenantId, executionId, nextEdge.targetNodeId);
      } else {
        await prisma.flowExecution.update({
          where: { id: executionId },
          data: { status: 'COMPLETED', finishedAt: new Date() },
        });
      }
    };

    if (node.type === 'CONDITION') {
      const result = evaluateCondition(node.config as any, contextData);
      await prisma.flowExecutionLog.create({
        data: { ...logStart, output: { result }, finishedAt: new Date() },
      });
      await advance(result ? 'true' : 'false');
      return;
    }

    if (node.type === 'WAIT') {
      const config = node.config as any;
      const delayMs = config.delayUntil
        ? Math.max(0, new Date(config.delayUntil).getTime() - Date.now())
        : Math.max(0, Number(config.delayMinutes ?? 0) * 60000);

      await prisma.flowExecution.update({ where: { id: executionId }, data: { status: 'WAITING' } });
      await prisma.flowExecutionLog.create({
        data: { ...logStart, output: { delayMs }, finishedAt: new Date() },
      });

      const nextEdge = pickNextEdge(flowEdges, nodeId);
      if (nextEdge) {
        await prisma.flowExecution.update({ where: { id: executionId }, data: { status: 'RUNNING' } });
        await enqueueNode(tenantId, executionId, nextEdge.targetNodeId, delayMs);
      } else {
        await prisma.flowExecution.update({
          where: { id: executionId },
          data: { status: 'COMPLETED', finishedAt: new Date() },
        });
      }
      return;
    }

    if (node.type === 'ACTION') {
      const flow = await prisma.flow.findUnique({ where: { id: node.flowId } });
      const config = resolveConfig(node.config as any, contextData);

      try {
        if (node.subtype === 'WEBHOOK_CALL') {
          const response = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': `${executionId}:${nodeId}` },
            body: JSON.stringify(contextData),
          });
          if (!response.ok) throw new Error(`Webhook call failed: ${response.status}`);
        } else if (node.subtype === 'ADD_TAG' || node.subtype === 'REMOVE_TAG') {
          await callInternalAction('tag', {
            tenantId,
            contactId: config.contactId ?? getByPath(contextData, 'contact.id'),
            tagId: config.tagId,
            mode: node.subtype === 'ADD_TAG' ? 'add' : 'remove',
          });
        } else {
          // Each internal-action DTO has its own exact (whitelisted) field
          // set — never spread `config` blindly, or an unrelated key trips
          // the API's forbidNonWhitelisted ValidationPipe.
          const actorUserId = flow?.createdByUserId;
          const contactId = config.contactId ?? getByPath(contextData, 'contact.id');

          switch (node.subtype) {
            case 'SEND_MESSAGE':
              await callInternalAction('send-message', {
                tenantId,
                actorUserId,
                conversationId: config.conversationId,
                content: config.content,
              });
              break;
            case 'ADD_NOTE':
              await callInternalAction('note', {
                tenantId,
                authorId: actorUserId,
                contactId,
                body: config.body,
              });
              break;
            case 'ASSIGN_CONVERSATION':
              await callInternalAction('assign-conversation', {
                tenantId,
                actorUserId,
                conversationId: config.conversationId,
                assignedToId: config.assignedToId,
              });
              break;
            case 'UPDATE_ORDER_STATUS':
              await callInternalAction('order-status', {
                tenantId,
                actorUserId,
                orderId: config.orderId,
                status: config.status,
                note: config.note,
              });
              break;
            case 'UPDATE_APPOINTMENT_STATUS':
              await callInternalAction('appointment-status', {
                tenantId,
                actorUserId,
                appointmentId: config.appointmentId,
                status: config.status,
                note: config.note,
              });
              break;
            case 'NOTIFY':
              await callInternalAction('notify', {
                tenantId,
                title: config.title,
                body: config.body,
                link: config.link,
                userId: config.userId,
              });
              break;
            case 'SEND_TEMPLATE':
              // Phase 17: Campaigns/Templates. `config.parameters` is an
              // array (resolveConfig only interpolates top-level strings),
              // so each {{path}} entry is resolved here explicitly, in
              // order, matching the template's {{1}}, {{2}}, ... slots.
              await callInternalAction('send-template', {
                tenantId,
                actorUserId,
                contactId,
                templateId: config.templateId,
                parameters: (config.parameters ?? []).map((p: string) => interpolate(p, contextData)),
              });
              break;
            default:
              throw new Error(`Unknown action subtype: ${node.subtype}`);
          }
        }

        await prisma.flowExecutionLog.create({
          data: { ...logStart, input: config, finishedAt: new Date() },
        });
        await advance();
      } catch (error: any) {
        await prisma.flowExecutionLog.create({
          data: { ...logStart, status: 'FAILED', input: config, error: error.message, finishedAt: new Date() },
        });
        throw error; // let BullMQ retry/backoff apply
      }
      return;
    }

    // TRIGGER (shouldn't normally be re-visited) / END / unknown types.
    await advance();
  }

  return async function processWorkflowJob(data: WorkflowJobData) {
    logger.info('Processing workflow job', { kind: data.kind, tenantId: data.tenantId });
    if (data.kind === 'event') {
      await handleEvent(data);
    } else {
      await handleNode(data);
    }
  };
}

/** Marks a FlowExecution FAILED once its node job has exhausted all retries. */
export async function markExecutionFailedIfExhausted(data: WorkflowJobData, attemptsMade: number, maxAttempts: number, errorMessage: string) {
  if (data.kind !== 'node' || !data.executionId) return;
  if (attemptsMade < maxAttempts) return;
  await prisma.flowExecution.update({
    where: { id: data.executionId },
    data: { status: 'FAILED', errorMessage, finishedAt: new Date() },
  });
}
