import { IsArray, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { OrderStatus, AppointmentStatus } from '@omniflow/database';

// All internal/flows/actions/* DTOs require tenantId explicitly, since these
// endpoints run before any per-request tenant context exists — the caller
// (apps/worker) is the one that resolved it from the triggering event.

export class InternalSendMessageDto {
  @IsString() declare tenantId: string;
  @IsString() declare conversationId: string;
  @IsString() @MinLength(1) declare content: string;
  @IsString() declare actorUserId: string;
}

export class InternalTagDto {
  @IsString() declare tenantId: string;
  @IsString() declare contactId: string;
  @IsString() declare tagId: string;
  @IsIn(['add', 'remove']) declare mode: 'add' | 'remove';
}

export class InternalNoteDto {
  @IsString() declare tenantId: string;
  @IsString() declare contactId: string;
  @IsString() declare authorId: string;
  @IsString() @MinLength(1) declare body: string;
}

export class InternalAssignConversationDto {
  @IsString() declare tenantId: string;
  @IsString() declare conversationId: string;
  @IsString() declare actorUserId: string;
  @IsOptional() @IsString() declare assignedToId?: string;
}

export class InternalOrderStatusDto {
  @IsString() declare tenantId: string;
  @IsString() declare orderId: string;
  @IsString() declare actorUserId: string;
  @IsEnum(OrderStatus) declare status: OrderStatus;
  @IsOptional() @IsString() declare note?: string;
}

export class InternalAppointmentStatusDto {
  @IsString() declare tenantId: string;
  @IsString() declare appointmentId: string;
  @IsString() declare actorUserId: string;
  @IsEnum(AppointmentStatus) declare status: AppointmentStatus;
  @IsOptional() @IsString() declare note?: string;
}

// Phase 17: Campaigns/Templates — closes the loop EVENTS_AND_WORKFLOWS.md
// describes ("mensajes/templates" as a workflow action). `parameters` is
// already-resolved (the worker ran the flow's {{path}} interpolation before
// calling this), ordered to match the template's {{1}}, {{2}}, ... slots.
export class InternalSendTemplateDto {
  @IsString() declare tenantId: string;
  @IsString() declare contactId: string;
  @IsString() declare actorUserId: string;
  @IsString() declare templateId: string;
  @IsOptional() @IsArray() @IsString({ each: true }) declare parameters?: string[];
}

// Generic NOTIFY workflow action — lets an operator wire up an in-app
// notification for any event, on top of the two built-in ones
// (order/appointment pending_approval) that fire without a flow at all.
// userId omitted => NotificationsService fans out to every active tenant user.
export class InternalNotifyDto {
  @IsString() declare tenantId: string;
  @IsString() @MinLength(1) declare title: string;
  @IsOptional() @IsString() declare body?: string;
  @IsOptional() @IsString() declare link?: string;
  @IsOptional() @IsString() declare userId?: string;
}
