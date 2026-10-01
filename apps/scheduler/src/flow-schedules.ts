import * as cron from 'node-cron';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';

/**
 * Phase 16: Workflows — SCHEDULE-type trigger nodes ("fecha/hora" in
 * EVENTS_AND_WORKFLOWS.md's trigger list). Unlike EVENT triggers (matched
 * generically against a domain event by apps/worker's flow-processor), a
 * schedule trigger is already resolved to one specific flow+node here, so
 * this creates the FlowExecution directly and enqueues its first node —
 * no need to round-trip through the worker's event-matching step.
 *
 * Stated limitation: single-scheduler-instance, no distributed lock (matches
 * the existing heartbeat's simplicity — fine for the current single-instance
 * deployment). A cron *expression* edit on an already-registered trigger
 * isn't picked up until this process restarts (only additions/removals are
 * diffed on each 5-minute refresh) — acceptable for this first pass.
 */
export function startFlowScheduleRefresh(connection: Redis) {
  const workflowsQueue = new Queue('workflows', { connection });
  const registered = new Map<string, cron.ScheduledTask>();

  function pickFirstOutgoingEdge(edges: any[], nodeId: string) {
    return edges.find((e) => e.sourceNodeId === nodeId);
  }

  async function fireTrigger(tenantId: string, flowId: string, nodeId: string, edges: any[]) {
    const execution = await prisma.flowExecution.create({
      data: {
        tenantId,
        flowId,
        triggerEventType: 'schedule',
        contextData: { trigger: 'schedule', firedAt: new Date().toISOString() },
      },
    });

    const nextEdge = pickFirstOutgoingEdge(edges, nodeId);
    if (nextEdge) {
      await workflowsQueue.add(
        'node',
        { kind: 'node', tenantId, executionId: execution.id, nodeId: nextEdge.targetNodeId },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 1000 },
      );
    } else {
      await prisma.flowExecution.update({
        where: { id: execution.id },
        data: { status: 'COMPLETED', finishedAt: new Date() },
      });
    }
  }

  async function refresh() {
    const flows = await prisma.flow.findMany({
      where: { status: 'ACTIVE', nodes: { some: { type: 'TRIGGER', subtype: 'SCHEDULE' } } },
      include: { nodes: true, edges: true },
    });

    const seen = new Set<string>();

    for (const flow of flows) {
      for (const node of flow.nodes) {
        if (node.type !== 'TRIGGER' || node.subtype !== 'SCHEDULE') continue;
        const cronExpr = (node.config as any)?.cron;
        if (!cronExpr || !cron.validate(cronExpr)) continue;

        seen.add(node.id);
        if (registered.has(node.id)) continue;

        const task = cron.schedule(cronExpr, () => {
          fireTrigger(flow.tenantId, flow.id, node.id, flow.edges).catch((err) =>
            logger.error('Scheduled flow trigger failed', err, { flowId: flow.id, nodeId: node.id }),
          );
        });
        registered.set(node.id, task);
      }
    }

    for (const [nodeId, task] of registered) {
      if (!seen.has(nodeId)) {
        task.stop();
        registered.delete(nodeId);
      }
    }
  }

  cron.schedule('*/5 * * * *', () => {
    refresh().catch((err) => logger.error('Flow schedule refresh failed', err));
  });

  // Run once at startup so newly-active schedules go live immediately.
  refresh().catch((err) => logger.error('Initial flow schedule refresh failed', err));
}
