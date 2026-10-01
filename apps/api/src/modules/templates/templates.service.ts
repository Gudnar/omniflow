import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { GRAPH_API_VERSION } from '../meta/meta.constants';
import { CreateTemplateDto, UpdateTemplateDto, ListTemplatesQueryDto } from './dto/template.dto';

// A template can only be edited while it hasn't been submitted (or was
// rejected and needs rework) — matching Meta: an already PENDING_APPROVAL/
// APPROVED template can't be silently edited out from under a live review.
const EDITABLE_STATUSES = ['DRAFT', 'REJECTED'];

@Injectable()
export class TemplatesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async list(query: ListTemplatesQueryDto) {
    return this.prisma.client.messageTemplate.findMany({
      where: { ...(query.status && { status: query.status }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.client.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('MessageTemplate');
    return template;
  }

  async create(dto: CreateTemplateDto) {
    return this.prisma.client.messageTemplate.create({ data: dto });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const template = await this.findOne(id);
    if (!EDITABLE_STATUSES.includes(template.status)) {
      throw new ValidationError(`Cannot edit a template in ${template.status} status`);
    }
    return this.prisma.client.messageTemplate.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.messageTemplate.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Submits the template to Meta for review via the real WhatsApp Business
   * Management API. This is a genuine external call — until the tenant has
   * connected a verified WABA, it will fail with Meta's own error, which is
   * surfaced as-is rather than swallowed.
   */
  async submit(id: string) {
    const template = await this.findOne(id);
    if (!EDITABLE_STATUSES.includes(template.status)) {
      throw new ValidationError(`Template is already ${template.status}`);
    }

    const tenantId = this.tenantContext.getTenantId();
    const connection = await this.prisma.client.metaConnection.findUnique({
      where: { tenantId_channel: { tenantId: tenantId!, channel: 'WHATSAPP' } },
    });
    if (!connection || !connection.wabaId) {
      throw new ValidationError(
        'Connect WhatsApp Business with a WABA ID before submitting templates for review',
      );
    }

    const components: any[] = [];
    if (template.headerText) components.push({ type: 'HEADER', format: 'TEXT', text: template.headerText });
    components.push({ type: 'BODY', text: template.bodyText });
    if (template.footerText) components.push({ type: 'FOOTER', text: template.footerText });

    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${connection.wabaId}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.accessToken}`,
        },
        body: JSON.stringify({
          name: template.name,
          category: template.category,
          language: template.language,
          components,
        }),
      },
    );

    const body: any = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.error?.message ?? `Meta rejected the template submission (${response.status})`;
      throw new ValidationError(message);
    }

    return this.prisma.client.messageTemplate.update({
      where: { id },
      data: {
        status: 'PENDING_APPROVAL',
        externalTemplateId: body?.id,
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });
  }

  /**
   * Manual fallback for pulling the current review status from Meta —
   * useful when the tenant's Meta App Dashboard doesn't have the
   * message_template_status_update webhook field subscribed yet.
   */
  async syncStatus(id: string) {
    const template = await this.findOne(id);
    if (!template.externalTemplateId) {
      throw new ValidationError('Template has not been submitted yet');
    }

    const tenantId = this.tenantContext.getTenantId();
    const connection = await this.prisma.client.metaConnection.findUnique({
      where: { tenantId_channel: { tenantId: tenantId!, channel: 'WHATSAPP' } },
    });
    if (!connection) {
      throw new ValidationError('WhatsApp Business is no longer connected for this tenant');
    }

    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${template.externalTemplateId}?fields=status,rejected_reason`,
      { headers: { Authorization: `Bearer ${connection.accessToken}` } },
    );
    const body: any = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ValidationError(body?.error?.message ?? `Meta rejected the status sync (${response.status})`);
    }

    return this.applyStatusUpdate(id, body?.status, body?.rejected_reason);
  }

  /** Shared by both the manual sync endpoint and the webhook auto-sync path. */
  async applyStatusUpdate(id: string, metaStatus: string | undefined, rejectedReason?: string | null) {
    const status = this.mapMetaStatus(metaStatus);
    if (!status) return this.findOne(id);

    return this.prisma.client.messageTemplate.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectedReason ?? null : null,
        reviewedAt: new Date(),
      },
    });
  }

  async findByExternalId(tenantId: string, externalTemplateId: string) {
    return this.prisma.raw.messageTemplate.findFirst({ where: { tenantId, externalTemplateId } });
  }

  private mapMetaStatus(metaStatus?: string): 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DISABLED' | null {
    switch (metaStatus) {
      case 'APPROVED': return 'APPROVED';
      case 'REJECTED': return 'REJECTED';
      case 'DISABLED': return 'DISABLED';
      case 'PENDING': return 'PENDING_APPROVAL';
      default: return null;
    }
  }
}
