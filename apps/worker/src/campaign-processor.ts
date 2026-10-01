import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';

/**
 * Phase 17: Campaigns/Templates. Runs outside the API's NestJS DI/CLS
 * context (same rationale as whatsapp-outbound-processor.ts) — raw prisma,
 * manual tenantId/id filters throughout.
 *
 * A `campaign-send` job only fans OUT: it creates one Message per recipient
 * and enqueues it onto the existing `channel-outbound` queue (reusing its
 * retry/backoff/DLQ infra rather than adding a second delivery path).
 * CampaignRecipient stays PENDING until that message's *actual* send
 * outcome is known — see finalizeCampaignRecipient(), called from
 * index.ts's channel-outbound completed/failed handlers — so "SENT" here
 * always means "Meta actually accepted it", not just "queued".
 */

interface VariableMappingEntry {
  source: 'contact_field' | 'static';
  value: string;
}

function resolveParameters(variableMapping: Record<string, VariableMappingEntry> | null | undefined, contact: any): string[] {
  if (!variableMapping) return [];
  // Positional {{1}}, {{2}}, ... — sort numerically, not lexicographically.
  const keys = Object.keys(variableMapping).sort((a, b) => Number(a) - Number(b));
  return keys.map((key) => {
    const entry = variableMapping[key];
    if (entry.source === 'contact_field') return String((contact as any)?.[entry.value] ?? '');
    return entry.value;
  });
}

export function createCampaignProcessor(connection: Redis) {
  const channelOutboundQueue = new Queue('channel-outbound', { connection });

  async function findOrCreateWhatsAppConversation(tenantId: string, contactId: string, phone: string | null) {
    let contactChannel = await prisma.contactChannel.findFirst({
      where: { tenantId, contactId, channel: 'WHATSAPP' },
    });
    if (!contactChannel) {
      if (!phone) return null;
      contactChannel = await prisma.contactChannel.create({
        data: { tenantId, contactId, channel: 'WHATSAPP', externalId: phone },
      });
    }

    let conversation = await prisma.conversation.findFirst({
      where: { contactChannelId: contactChannel.id, status: { not: 'CLOSED' } },
      orderBy: { lastMessageAt: 'desc' },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId,
          channel: 'WHATSAPP',
          contactChannelId: contactChannel.id,
          lastMessageAt: new Date(),
        },
      });
    }
    return conversation.id;
  }

  return async function processCampaignSend(data: { campaignId: string }) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId },
      include: { template: true },
    });
    if (!campaign) {
      logger.error('Campaign send job: campaign not found', undefined, { campaignId: data.campaignId });
      return;
    }

    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id, status: 'PENDING' },
    });

    for (const recipient of recipients) {
      try {
        const contact = await prisma.contact.findUnique({ where: { id: recipient.contactId } });
        if (!contact) throw new Error('Contact not found');

        const conversationId = await findOrCreateWhatsAppConversation(campaign.tenantId, contact.id, contact.phone);
        if (!conversationId) throw new Error('Contact has no phone number for WhatsApp');

        const parameters = resolveParameters(campaign.variableMapping as any, contact);
        const templatePayload = {
          name: campaign.template.name,
          language: { code: campaign.template.language },
          ...(parameters.length
            ? { components: [{ type: 'body', parameters: parameters.map((text) => ({ type: 'text', text })) }] }
            : {}),
        };

        const message = await prisma.message.create({
          data: {
            tenantId: campaign.tenantId,
            conversationId,
            direction: 'OUTBOUND',
            type: 'TEMPLATE',
            content: campaign.template.bodyText,
            campaignId: campaign.id,
            templatePayload,
          },
        });
        await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });

        await channelOutboundQueue.add(
          'send-message',
          { messageId: message.id, channel: 'WHATSAPP' },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: 1000,
          },
        );
        // Recipient stays PENDING — flipped to SENT/FAILED once the actual
        // Graph API call resolves (see finalizeCampaignRecipient below).
      } catch (error: any) {
        // Setup failures (no contact, no phone) never reach the queue, so
        // they're final here — mark FAILED immediately.
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED', errorMessage: error.message },
        });
        await maybeCompleteCampaign(campaign.id);
      }

      // Fixed small delay between recipients — a stated simplification vs.
      // WhatsApp's real per-tier throughput limits, not modeled here.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };
}

/** Flips one CampaignRecipient to its final state once its Message's real send outcome is known. */
export async function finalizeCampaignRecipient(
  messageId: string,
  outcome: 'SENT' | 'FAILED',
  errorMessage?: string,
): Promise<void> {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message?.campaignId) return; // not a campaign message

  await prisma.campaignRecipient.updateMany({
    where: { campaignId: message.campaignId, contactId: (await conversationContactId(message.conversationId)) ?? undefined },
    data: { status: outcome, sentAt: outcome === 'SENT' ? new Date() : undefined, errorMessage: outcome === 'FAILED' ? errorMessage : null },
  });

  await maybeCompleteCampaign(message.campaignId);
}

async function conversationContactId(conversationId: string): Promise<string | undefined> {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  return conversation?.contactId;
}

async function maybeCompleteCampaign(campaignId: string): Promise<void> {
  const pending = await prisma.campaignRecipient.count({ where: { campaignId, status: 'PENDING' } });
  if (pending > 0) return;

  await prisma.campaign.updateMany({
    where: { id: campaignId, status: 'RUNNING' },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
}
