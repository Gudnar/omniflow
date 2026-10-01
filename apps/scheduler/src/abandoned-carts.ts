import * as cron from 'node-cron';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';

// An ACTIVE cart untouched for this long is considered abandoned.
const ABANDONED_THRESHOLD_MINUTES = 30;

/**
 * Phase 16: Workflows — cart.abandoned (CONVERSATIONAL_ECOMMERCE.md: "cart.abandoned
 * puede activar workflow de recuperación"). Runs across all tenants (no Nest
 * DI/EventsService here), so it duplicates EventsService.emit's two side
 * effects manually: write an Event row, enqueue onto the `workflows` queue —
 * same raw-prisma rationale as every other cross-app job in this codebase.
 * `Cart.abandonedNotifiedAt` ensures each cart fires at most once.
 */
export function startAbandonedCartScan(connection: Redis) {
  const workflowsQueue = new Queue('workflows', { connection });

  async function scan() {
    const cutoff = new Date(Date.now() - ABANDONED_THRESHOLD_MINUTES * 60000);

    const carts = await prisma.cart.findMany({
      where: { status: 'ACTIVE', abandonedNotifiedAt: null, updatedAt: { lt: cutoff } },
    });

    for (const cart of carts) {
      const payload = { cartId: cart.id, contactId: cart.contactId, total: Number(cart.total) };

      const event = await prisma.event.create({
        data: { tenantId: cart.tenantId, type: 'cart.abandoned', payload, contactId: cart.contactId },
      });

      await workflowsQueue.add(
        'event',
        { kind: 'event', tenantId: cart.tenantId, eventType: 'cart.abandoned', payload, eventId: event.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 1000 },
      );

      await prisma.cart.update({ where: { id: cart.id }, data: { abandonedNotifiedAt: new Date() } });
    }

    if (carts.length) {
      logger.info('Abandoned-cart scan: emitted cart.abandoned', { count: carts.length });
    }
  }

  cron.schedule('*/15 * * * *', () => {
    scan().catch((err) => logger.error('Abandoned-cart scan failed', err));
  });
}
