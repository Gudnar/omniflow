import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { TemplateCategory, TemplateStatus } from '@omniflow/database';

// Meta's real naming rule for WhatsApp message templates: lowercase letters,
// digits, and underscores only.
const NAME_PATTERN = /^[a-z0-9_]+$/;

export class CreateTemplateDto {
  @IsString()
  @Matches(NAME_PATTERN, { message: 'name must be lowercase letters, digits, and underscores only' })
  declare name: string;

  @IsEnum(TemplateCategory)
  declare category: TemplateCategory;

  @IsString()
  @MinLength(2)
  declare language: string;

  @IsOptional() @IsString() declare headerText?: string;

  @IsString()
  @MinLength(1)
  declare bodyText: string;

  @IsOptional() @IsString() declare footerText?: string;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() declare headerText?: string;
  @IsOptional() @IsString() @MinLength(1) declare bodyText?: string;
  @IsOptional() @IsString() declare footerText?: string;
}

export class ListTemplatesQueryDto {
  @IsOptional() @IsEnum(TemplateStatus) declare status?: TemplateStatus;
}
