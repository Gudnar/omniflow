import * as cron from 'node-cron';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';

/**
 * Phase 17: Campaigns/Templates — fires campaigns whose `scheduledAt` has
 * arrived. Duplicates CampaignsService.send()'s resolve+enqueue logic via
 * raw prisma (no Nest DI here), same precedent as abandoned-carts.ts
 * duplicating EventsService's side effects.
 */
export function startScheduledCampaignsRefresh(connection: Redis) {
  const campaignsQueue = new Queue('campaigns', { connection });

  function buildContactWhere(filterQuery: any) {
    const filter = filterQuery ?? {};
    return {
      ...(filter.status && { status: filter.status }),
      ...(filter.type && { type: filter.type }),
      ...(filter.tagIds?.length && { tags: { some: { tagId: { in: filter.tagIds } } } }),
    };
  }

  async function fireCampaign(campaign: { id: string; tenantId: string; segmentId: string }) {
    const segment = await prisma.segment.findUnique({ where: { id: campaign.segmentId } });
    if (!segment) {
      logger.error('Scheduled campaign: segment not found', undefined, { campaignId: campaign.id });
      return;
    }

    const contacts = await prisma.contact.findMany({
      where: { tenantId: campaign.tenantId, ...buildContactWhere(segment.filterQuery) },
      select: { id: true },
    });
    if (!contacts.length) {
      logger.warn('Scheduled campaign: segment has no matching contacts, leaving as SCHEDULED', {
        campaignId: campaign.id,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.campaignRecipient.createMany({
        data: contacts.map((c) => ({ tenantId: campaign.tenantId, campaignId: campaign.id, contactId: c.id })),
        skipDuplicates: true,
      });
      await tx.campaign.update({ where: { id: campaign.id }, data: { status: 'RUNNING', startedAt: new Date() } });
    });

    await campaignsQueue.add(
      'campaign-send',
      { campaignId: campaign.id },
      { attempts: 2, backoff: { type: 'exponential', delay: 10000 }, removeOnComplete: true, removeOnFail: 1000 },
    );

    logger.info('Scheduled campaign fired', { campaignId: campaign.id, recipientCount: contacts.length });
  }

  async function refresh() {
    const due = await prisma.campaign.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    });
    for (const campaign of due) {
      await fireCampaign(campaign).catch((err) =>
        logger.error('Scheduled campaign failed to fire', err, { campaignId: campaign.id }),
      );
    }
  }

  cron.schedule('*/5 * * * *', () => {
    refresh().catch((err) => logger.error('Scheduled-campaigns refresh failed', err));
  });
}
