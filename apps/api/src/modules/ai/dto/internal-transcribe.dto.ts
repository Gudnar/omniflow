import { IsString } from 'class-validator';

// Same "tenantId required explicitly" rationale as InternalAiReplyDto.
export class InternalTranscribeDto {
  @IsString() declare tenantId: string;
  @IsString() declare messageId: string;
}
