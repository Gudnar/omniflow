import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { QueueService } from '../queue/queue.service';

/**
 * Phase 16: Workflows — the "evento" step of ARCHITECTURE.md's
 * `evento → cola → worker` pipeline. Domain services call `emit()` at their
 * confirmation points (order confirmed, appointment cancelled, etc., per
 * EVENTS_AND_WORKFLOWS.md's catalog); this writes an audit-trail `Event` row
 * and enqueues a job onto the `workflows` BullMQ queue, which apps/worker's
 * flow-processor matches against tenants' ACTIVE flows.
 *
 * Reads tenantId from the ambient CLS context rather than taking it as a
 * parameter, since every call site already runs inside a request (or a
 * webhook handler that has already called TenantContextService.setContext) —
 * this keeps call sites terse.
 */
@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private queueService: QueueService,
  ) {}

  async emit(type: string, payload: Record<string, any>, contactId?: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) return;

    const event = await this.prisma.client.event.create({
      data: { type, payload, contactId },
    });

    await this.queueService.enqueueWorkflowEvent(tenantId, type, payload, event.id);
  }
}
