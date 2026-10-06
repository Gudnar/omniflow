import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Capped at 3 — WhatsApp's native "reply button" interactive message type
// hard-limits to 3 buttons; kept the same everywhere rather than a
// channel-conditional cap, so an operator never builds something that works
// on web chat but silently breaks on WhatsApp.
export class SendQuickRepliesDto {
  @IsString()
  @MinLength(1)
  declare message: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  declare options: string[];
}

export class FormFieldDto {
  @IsString()
  @MinLength(1)
  declare label: string;

  @IsIn(['text', 'email', 'tel', 'number'])
  declare fieldType: 'text' | 'email' | 'tel' | 'number';
}

// Webchat-only — rejected server-side (MessagesService.sendForm) for any
// other channel. WhatsApp's regular interactive messages have no multi-field
// form type (that's the separate "Flows" product).
export class SendFormDto {
  @IsString()
  @MinLength(1)
  declare message: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  declare fields: FormFieldDto[];

  @IsString()
  @IsOptional()
  declare submitLabel?: string;
}
