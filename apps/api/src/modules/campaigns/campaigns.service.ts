import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { QueueService } from '../queue/queue.service';
import { SegmentsService } from './segments.service';
import { CreateCampaignDto, UpdateCampaignDto, ListCampaignsQueryDto } from './dto/campaign.dto';

const CAMPAIGN_INCLUDE = {
  template: { select: { id: true, name: true, status: true } },
  segment: { select: { id: true, name: true } },
};

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private queueService: QueueService,
    private segmentsService: SegmentsService,
  ) {}

  async list(query: ListCampaignsQueryDto) {
    return this.prisma.client.campaign.findMany({
      where: { ...(query.status && { status: query.status }) },
      include: CAMPAIGN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.client.campaign.findUnique({ where: { id }, include: CAMPAIGN_INCLUDE });
    if (!campaign) throw new NotFoundError('Campaign');

    // `groupBy` isn't one of the operations the tenant-scope extension
    // auto-injects tenantId into (see packages/database/src/tenant-scope.ts),
    // so it's added explicitly here as defense-in-depth — `campaign` above
    // was already tenant-validated via the scoped findUnique in `findOne`.
    const tenantId = this.tenantContext.getTenantId();
    const counts = await this.prisma.client.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: id, tenantId },
      _count: true,
    });
    const recipientCounts = { PENDING: 0, SENT: 0, FAILED: 0 } as Record<string, number>;
    for (const row of counts) recipientCounts[row.status] = row._count;

    return { ...campaign, recipientCounts };
  }

  async create(dto: CreateCampaignDto, actorUserId: string) {
    const template = await this.prisma.client.messageTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template) throw new NotFoundError('MessageTemplate');
    if (template.status !== 'APPROVED') {
      throw new ValidationError('Campaigns can only use an APPROVED template (WhatsApp requires an approved template for proactive/bulk sends)');
    }
    await this.segmentsService.findOne(dto.segmentId);

    return this.prisma.client.campaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        templateId: dto.templateId,
        segmentId: dto.segmentId,
        variableMapping: dto.variableMapping ?? {},
        createdByUserId: actorUserId,
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.findOne(id);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new ValidationError(`Cannot edit a campaign in ${campaign.status} status`);
    }
    return this.prisma.client.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.scheduledAt !== undefined && { scheduledAt: new Date(dto.scheduledAt), status: 'SCHEDULED' }),
        ...(dto.variableMapping !== undefined && { variableMapping: dto.variableMapping }),
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async remove(id: string) {
    const campaign = await this.findOne(id);
    if (campaign.status === 'RUNNING') {
      throw new ValidationError('Cannot delete a campaign while it is running');
    }
    await this.prisma.client.campaign.delete({ where: { id } });
    return { success: true };
  }

  async listRecipients(id: string) {
    await this.findOne(id);
    return this.prisma.client.campaignRecipient.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async send(id: string) {
    const campaign = await this.findOne(id);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new ValidationError(`Cannot send a campaign in ${campaign.status} status`);
    }
    if (campaign.template.status !== 'APPROVED') {
      throw new ValidationError('The campaign\'s template is no longer APPROVED');
    }

    const contactIds = await this.segmentsService.resolveContactIds(campaign.segmentId);
    if (!contactIds.length) {
      throw new ValidationError('The segment has no matching contacts');
    }

    const tenantId = this.tenantContext.getTenantId();

    await this.prisma.client.$transaction(async (tx: any) => {
      await tx.campaignRecipient.createMany({
        data: contactIds.map((contactId: string) => ({ campaignId: id, contactId })),
        skipDuplicates: true,
      });
      await tx.campaign.update({ where: { id }, data: { status: 'RUNNING', startedAt: new Date() } });
    });

    await this.queueService.enqueueCampaignSend(id);
    // tenantId isn't needed by the job payload (the worker re-derives it
    // from the Campaign row, same "thin job, re-fetch context" precedent as
    // channel-outbound) — read here only to fail loudly if somehow missing.
    if (!tenantId) throw new ValidationError('Tenant context is required to send a campaign');

    return this.findOne(id);
  }
}
