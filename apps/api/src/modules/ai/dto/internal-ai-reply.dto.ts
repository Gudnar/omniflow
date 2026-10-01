import { IsString } from 'class-validator';

// Same "tenantId required explicitly" rationale as internal-actions/dto:
// this runs before any per-request tenant context exists — apps/worker
// resolved it from the triggering message.received event.
export class InternalAiReplyDto {
  @IsString() declare tenantId: string;
  @IsString() declare conversationId: string;
  @IsString() declare messageId: string;
}
