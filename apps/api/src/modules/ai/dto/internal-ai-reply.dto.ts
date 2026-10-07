import { IsOptional, IsString } from 'class-validator';

// Same "tenantId required explicitly" rationale as internal-actions/dto:
// this runs before any per-request tenant context exists — apps/worker
// resolved it from the triggering message.received event.
export class InternalAiReplyDto {
  @IsString() declare tenantId: string;
  @IsString() declare conversationId: string;
  // Absent/null for the proactive web-chat greeting — no real customer
  // message triggered it. See AiReplyService.generateReply.
  @IsOptional() @IsString() declare messageId?: string | null;
}
