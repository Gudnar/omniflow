import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ConversationStatus, Channel } from '@omniflow/database';

export class ListConversationsQueryDto {
  @IsEnum(ConversationStatus)
  @IsOptional()
  declare status?: ConversationStatus;

  @IsEnum(Channel)
  @IsOptional()
  declare channel?: Channel;

  @IsString()
  @IsOptional()
  declare contactId?: string;

  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsString()
  @IsOptional()
  declare assignedToId?: string;
}
