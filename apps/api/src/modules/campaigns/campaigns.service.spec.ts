import { CampaignsService } from './campaigns.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prisma: any;
  let tx: any;
  let tenantContext: any;
  let queueService: any;
  let segmentsService: any;

  beforeEach(() => {
    tx = {
      campaignRecipient: { createMany: jest.fn() },
      campaign: { update: jest.fn() },
    };
    prisma = {
      client: {
        campaign: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        campaignRecipient: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn() },
        messageTemplate: { findUnique: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    tenantContext = { getTenantId: jest.fn().mockReturnValue('tenant-1') };
    queueService = { enqueueCampaignSend: jest.fn() };
    segmentsService = { findOne: jest.fn(), resolveContactIds: jest.fn() };
    service = new CampaignsService(prisma, tenantContext, queueService, segmentsService);
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.campaign.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
    });

    it('folds recipient groupBy counts into a flat PENDING/SENT/FAILED map', async () => {
      prisma.client.campaign.findUnique.mockResolvedValue({ id: 'c1', status: 'RUNNING' });
      prisma.client.campaignRecipient.groupBy.mockResolvedValue([
        { status: 'SENT', _count: 3 },
        { status: 'FAILED', _count: 1 },
      ]);

      const result = await service.findOne('c1');

      expect(result.recipientCounts).toEqual({ PENDING: 0, SENT: 3, FAILED: 1 });
    });
  });

  describe('create', () => {
    it('rejects a template that is not APPROVED', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'PENDING_APPROVAL' });
      await expect(
        service.create({ name: 'Promo', templateId: 't1', segmentId: 's1' } as any, 'u1'),
      ).rejects.toThrow(ValidationError);
    });

    it('creates a DRAFT campaign when the template is APPROVED and the segment exists', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'APPROVED' });
      segmentsService.findOne.mockResolvedValue({ id: 's1' });
      prisma.client.campaign.create.mockResolvedValue({ id: 'c1' });

      await service.create({ name: 'Promo', templateId: 't1', segmentId: 's1' } as any, 'u1');

      expect(prisma.client.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Promo', templateId: 't1', segmentId: 's1', createdByUserId: 'u1' }),
        }),
      );
    });
  });

  describe('send', () => {
    it('rejects sending a campaign that is already RUNNING', async () => {
      prisma.client.campaign.findUnique.mockResolvedValue({ id: 'c1', status: 'RUNNING', template: { status: 'APPROVED' } });
      await expect(service.send('c1')).rejects.toThrow(ValidationError);
      expect(segmentsService.resolveContactIds).not.toHaveBeenCalled();
    });

    it('rejects when the segment has no matching contacts', async () => {
      prisma.client.campaign.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'DRAFT',
        segmentId: 's1',
        template: { status: 'APPROVED' },
      });
      segmentsService.resolveContactIds.mockResolvedValue([]);
      await expect(service.send('c1')).rejects.toThrow(ValidationError);
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it('creates recipient rows, marks the campaign RUNNING, and enqueues the send job', async () => {
      prisma.client.campaign.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'DRAFT',
        segmentId: 's1',
        template: { status: 'APPROVED' },
      });
      segmentsService.resolveContactIds.mockResolvedValue(['c1', 'c2']);

      await service.send('c1');

      expect(tx.campaignRecipient.createMany).toHaveBeenCalledWith({
        data: [{ campaignId: 'c1', contactId: 'c1' }, { campaignId: 'c1', contactId: 'c2' }],
        skipDuplicates: true,
      });
      expect(tx.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'RUNNING', startedAt: expect.any(Date) },
      });
      expect(queueService.enqueueCampaignSend).toHaveBeenCalledWith('c1');
    });
  });
});
