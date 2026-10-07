import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { Channel } from '@omniflow/database';

export class CreateConversationDto {
  @IsString()
  declare contactId: string;

  @IsEnum(Channel)
  declare channel: Channel;

  @IsString()
  @IsOptional()
  declare externalId?: string;

  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsString()
  @IsOptional()
  declare assignedToId?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare firstMessageContent?: string;

  @IsString()
  @IsOptional()
  declare firstMessageExternalId?: string;

  @IsBoolean()
  @IsOptional()
  declare isNewContact?: boolean;

  @IsObject()
  @IsOptional()
  declare adReferral?: Record<string, any>;
}
