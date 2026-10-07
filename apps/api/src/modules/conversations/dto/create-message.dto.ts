import { IsEnum, IsOptional, IsString, MinLength, IsInt, IsUrl } from 'class-validator';
import { MessageDirection, MessageType } from '@omniflow/database';

export class CreateMessageDto {
  @IsEnum(MessageDirection)
  declare direction: MessageDirection;

  @IsEnum(MessageType)
  @IsOptional()
  declare type?: MessageType;

  @IsString()
  @MinLength(1)
  declare content: string;

  @IsUrl()
  @IsOptional()
  declare attachmentUrl?: string;

  @IsString()
  @IsOptional()
  declare attachmentMimeType?: string;

  @IsString()
  @IsOptional()
  declare attachmentFileName?: string;

  @IsInt()
  @IsOptional()
  declare attachmentSize?: number;

  @IsString()
  @IsOptional()
  declare externalId?: string;

  // Internal-only — populated exclusively by AiReplyService when persisting
  // an agent-initiated CTA message. Deliberately undecorated: the global
  // ValidationPipe (main.ts) runs with whitelist+forbidNonWhitelisted, so any
  // HTTP body that tries to set this field is rejected with 400 before it
  // ever reaches the service. Only an in-process call (which bypasses the
  // pipe entirely) can populate it.
  declare ctaPayload?: { action: 'STORE' | 'BOOKING'; url: string; label: string };

  // Internal-only, same protection as ctaPayload above — constructed
  // server-side only, by either AiReplyService's send_quick_replies/send_form
  // tools or MessagesService.sendQuickReplies()/sendForm() (the human-operator
  // path, itself fed by its own strictly-validated DTO, never a raw client blob).
  declare interactivePayload?:
    | { kind: 'quick_replies'; message: string; options: { id: string; label: string }[] }
    | { kind: 'form'; message: string; fields: { id: string; label: string; fieldType: 'text' | 'email' | 'tel' | 'number' }[]; submitLabel: string };

  // Internal-only — set exclusively by ConversationWindowService.sendMessage()
  // when the customer typed this INBOUND message via /chat/[token] rather
  // than the real external channel. Same undecorated/forbidNonWhitelisted
  // protection as ctaPayload above. MessagesService.create() uses it to
  // decide whether the NEXT outbound reply on this conversation should
  // re-dispatch to the real channel or stay web-only.
  declare viaWebWindow?: boolean;

  // Internal-only, same protection as viaWebWindow above — set exclusively
  // by MetaWebhookService when this INBOUND message arrived after the
  // tenant's whatsappFreeWindowHours lapsed: the message still gets saved,
  // but the normal AI-reply job is skipped because sendReturningContactOptions
  // (called right after) pauses the agent on this conversation instead.
  declare skipAiReply?: boolean;
}
