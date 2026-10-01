import { IsEnum } from 'class-validator';
import { ConversationStatus } from '@omniflow/database';

export class UpdateConversationStatusDto {
  @IsEnum(ConversationStatus)
  declare status: ConversationStatus;
}
