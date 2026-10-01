import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';
import { Public } from '../auth/decorators';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { MessagesService } from '../conversations/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ContactsService } from '../contacts/contacts.service';
import { NotesService } from '../contacts/notes.service';
import { OrdersService } from '../commerce/orders.service';
import { AppointmentsService } from '../booking/appointments.service';
import { TemplatesService } from '../templates/templates.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  InternalSendMessageDto,
  InternalTagDto,
  InternalNoteDto,
  InternalAssignConversationDto,
  InternalOrderStatusDto,
  InternalAppointmentStatusDto,
  InternalSendTemplateDto,
  InternalNotifyDto,
} from './dto/internal-action.dto';

/**
 * Phase 16: Workflows — action-execution surface for apps/worker's flow
 * engine. @Public() bypasses the global JwtAuthGuard (there's no end-user
 * session for a server-to-server call); InternalApiKeyGuard is the only auth
 * layer. Every handler seeds TenantContextService manually before delegating
 * to the real, unmodified domain service — safe here because tenantId comes
 * from our own trigger-matching code (apps/worker), never from an external
 * client, exactly like meta-webhook.service.ts already does for webhooks.
 */
@Controller('internal/flows/actions')
@Public()
@UseGuards(InternalApiKeyGuard)
export class InternalFlowActionsController {
  constructor(
    private tenantContext: TenantContextService,
    private prisma: PrismaService,
    private queueService: QueueService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    private contactsService: ContactsService,
    private notesService: NotesService,
    private ordersService: OrdersService,
    private appointmentsService: AppointmentsService,
    private templatesService: TemplatesService,
    private notificationsService: NotificationsService,
  ) {}

  @Post('send-message')
  async sendMessage(@Body() dto: InternalSendMessageDto) {
    this.tenantContext.setContext({ tenantId: dto.tenantId, userId: dto.actorUserId });
    const message = await this.messagesService.create(dto.conversationId, dto.actorUserId, {
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: dto.content,
    });
    return { success: true, message };
  }

  @Post('tag')
  async tag(@Body() dto: InternalTagDto) {
    this.tenantContext.setContext({ tenantId: dto.tenantId });
    const contact =
      dto.mode === 'add'
        ? await this.contactsService.attachTag(dto.contactId, dto.tagId)
        : await this.contactsService.detachTag(dto.contactId, dto.tagId);
    return { success: true, contact };
  }

  @Post('note')
  async note(@Body() dto: InternalNoteDto) {
    this.tenantContext.setContext({ tenantId: dto.tenantId, userId: dto.authorId });
    const note = await this.notesService.create(dto.contactId, dto.authorId, { body: dto.body });
    return { success: true, note };
  }

  @Post('assign-conversation')
  async assignConversation(@Body() dto: InternalAssignConversationDto) {
    this.tenantContext.setContext({ tenantId: dto.tenantId, userId: dto.actorUserId });
    const conversation = await this.conversationsService.assign(
      dto.conversationId,
      { assignedToId: dto.assignedToId },
      dto.actorUserId,
    );
    return { success: true, conversation };
  }

  @Post('order-status')
  async orderStatus(@Body() dto: InternalOrderStatusDto) {
    this.tenantContext.setContext({ tenantId: dto.tenantId, userId: dto.actorUserId });
    const order = await this.ordersService.setStatus(dto.orderId, dto.actorUserId, {
      status: dto.status,
      note: dto.note,
    });
    return { success: true, order };
  }

  @Post('appointment-status')
  async appointmentStatus(@Body() dto: InternalAppointmentStatusDto) {
    this.tenantContext.setContext({ tenantId: dto.tenantId, userId: dto.actorUserId });
    const appointment = await this.appointmentsService.setStatus(dto.appointmentId, dto.actorUserId, {
      status: dto.status,
      note: dto.note,
    });
    return { success: true, appointment };
  }

  @Post('notify')
  async notify(@Body() dto: InternalNotifyDto) {
    this.tenantContext.setContext({ tenantId: dto.tenantId });
    await this.notificationsService.create({
      userId: dto.userId,
      type: 'workflow.notify',
      title: dto.title,
      body: dto.body,
      link: dto.link,
    });
    return { success: true };
  }

  // Phase 17: Campaigns/Templates — lets a Flow's ACTION node send an
  // APPROVED WhatsApp template (EVENTS_AND_WORKFLOWS.md lists "mensajes/
  // templates" as a workflow action; CONVERSATIONAL_ECOMMERCE.md calls out
  // cart.abandoned as a recovery-workflow trigger — this is the mechanism).
  @Post('send-template')
  async sendTemplate(@Body() dto: InternalSendTemplateDto) {
    this.tenantContext.setContext({ tenantId: dto.tenantId, userId: dto.actorUserId });

    const template = await this.templatesService.findOne(dto.templateId);
    if (template.status !== 'APPROVED') {
      throw new ValidationError('Cannot send a template that is not APPROVED');
    }

    const conversationId = await this.findOrCreateWhatsAppConversation(dto.contactId);

    const parameters = (dto.parameters ?? []).map((text) => ({ type: 'text', text }));
    const templatePayload = {
      name: template.name,
      language: { code: template.language },
      ...(parameters.length ? { components: [{ type: 'body', parameters }] } : {}),
    };

    const message = await this.prisma.client.$transaction(async (tx: any) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          direction: 'OUTBOUND',
          type: 'TEMPLATE',
          content: template.bodyText,
          templatePayload,
        },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
      return created;
    });

    await this.queueService.enqueueChannelOutboundMessage('WHATSAPP', message.id);
    return { success: true, message };
  }

  /** Find the contact's open WhatsApp conversation, or start a new one from their phone number. */
  private async findOrCreateWhatsAppConversation(contactId: string): Promise<string> {
    const contactChannel = await this.prisma.client.contactChannel.findFirst({
      where: { contactId, channel: 'WHATSAPP' },
    });
    if (contactChannel) {
      const open = await this.prisma.client.conversation.findFirst({
        where: { contactChannelId: contactChannel.id, status: { not: 'CLOSED' } },
        orderBy: { lastMessageAt: 'desc' },
      });
      if (open) return open.id;
    }

    const contact = await this.prisma.client.contact.findUnique({ where: { id: contactId } });
    if (!contact?.phone) {
      throw new ValidationError('Contact has no phone number to start a WhatsApp conversation');
    }

    const conversation = await this.conversationsService.create({
      contactId,
      channel: 'WHATSAPP',
      externalId: contact.phone,
    } as any);
    return conversation.id;
  }
}
