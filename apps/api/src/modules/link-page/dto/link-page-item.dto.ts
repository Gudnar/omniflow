import { IsString, IsOptional, IsInt, IsBoolean, Min, MinLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// `url` is deliberately just a non-empty string, not @IsUrl() — operators
// paste wa.me links, mailto:, tel:, or plain external URLs, and there's no
// value in second-guessing that here (same looseness as SectionItemDto's
// free-form `config`).
export class LinkPageItemDto {
  @IsString()
  @IsOptional()
  declare id?: string;

  @IsString()
  @MinLength(1)
  declare label: string;

  @IsString()
  @MinLength(1)
  declare url: string;

  // Cosmetic key rendered client-side (whatsapp|instagram|facebook|tiktok|link).
  @IsString()
  @IsOptional()
  declare icon?: string;

  @IsInt()
  @Min(0)
  declare sortOrder: number;

  @IsBoolean()
  @IsOptional()
  declare enabled?: boolean;
}

export class UpdateLinkPageItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkPageItemDto)
  declare items: LinkPageItemDto[];
}
