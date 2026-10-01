import { IsDateString, IsEnum, IsIn, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus } from '@omniflow/database';

export class VariableMappingEntryDto {
  @IsIn(['contact_field', 'static']) declare source: 'contact_field' | 'static';
  @IsString() declare value: string;
}

export class CreateCampaignDto {
  @IsString() @MinLength(1) declare name: string;
  @IsOptional() @IsString() declare description?: string;
  @IsString() declare templateId: string;
  @IsString() declare segmentId: string;

  // {"1": {source, value}, "2": {source, value}, ...} — validated as a plain
  // object here; each entry's shape is documented by VariableMappingEntryDto
  // but not deep-validated per-key (class-validator doesn't support
  // dynamic-key nested validation cleanly) — the service re-checks shape
  // defensively before use.
  @IsOptional() @IsObject() declare variableMapping?: Record<string, { source: 'contact_field' | 'static'; value: string }>;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() @MinLength(1) declare name?: string;
  @IsOptional() @IsString() declare description?: string;
  @IsOptional() @IsDateString() declare scheduledAt?: string;
  @IsOptional() @IsObject() declare variableMapping?: Record<string, { source: 'contact_field' | 'static'; value: string }>;
}

export class ListCampaignsQueryDto {
  @IsOptional() @IsEnum(CampaignStatus) declare status?: CampaignStatus;
}
