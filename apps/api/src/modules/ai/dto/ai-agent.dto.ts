import { IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Channel, AiAgentStatus } from '@omniflow/database';
import { ALL_TOOL_NAMES } from '../tools/registry';

export class CreateAiAgentDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsString()
  declare modelId: string;

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  declare status?: AiAgentStatus;

  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  declare temperature?: number;

  @IsString()
  @IsOptional()
  declare goal?: string;

  @IsString()
  @IsOptional()
  declare personality?: string;

  @IsString()
  @IsOptional()
  declare language?: string;

  @IsArray()
  @IsEnum(Channel, { each: true })
  declare channels: Channel[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare escalationKeywords?: string[];

  @IsInt()
  @Min(50)
  @Max(4000)
  @IsOptional()
  declare maxTokens?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare knowledgeDocumentIds?: string[];

  @IsArray()
  @IsIn(ALL_TOOL_NAMES, { each: true })
  @IsOptional()
  declare enabledTools?: string[];
}

export class UpdateAiAgentDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsString()
  @IsOptional()
  declare modelId?: string;

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  declare status?: AiAgentStatus;

  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  declare temperature?: number;

  @IsString()
  @IsOptional()
  declare goal?: string;

  @IsString()
  @IsOptional()
  declare personality?: string;

  @IsString()
  @IsOptional()
  declare language?: string;

  @IsArray()
  @IsEnum(Channel, { each: true })
  @IsOptional()
  declare channels?: Channel[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare escalationKeywords?: string[];

  @IsInt()
  @Min(50)
  @Max(4000)
  @IsOptional()
  declare maxTokens?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare knowledgeDocumentIds?: string[];

  @IsArray()
  @IsIn(ALL_TOOL_NAMES, { each: true })
  @IsOptional()
  declare enabledTools?: string[];
}
