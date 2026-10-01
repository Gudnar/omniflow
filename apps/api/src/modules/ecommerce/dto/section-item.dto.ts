import { IsString, IsOptional, IsEnum, IsObject, IsInt, IsBoolean, Min } from 'class-validator';
import { EcommerceSectionType } from '@omniflow/database';

// `config` is intentionally a free-form object — its shape depends on
// `type` (banner: { imageUrl, linkUrl }; text_block: { body }; image_gallery:
// { imageUrls: string[] }) and there's no Product model yet to justify a
// stricter discriminated-union DTO for this first pass.
export class SectionItemDto {
  @IsString()
  @IsOptional()
  declare id?: string;

  @IsEnum(EcommerceSectionType)
  declare type: EcommerceSectionType;

  @IsString()
  @IsOptional()
  declare title?: string;

  @IsString()
  @IsOptional()
  declare subtitle?: string;

  @IsObject()
  @IsOptional()
  declare config?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  declare sortOrder: number;

  @IsBoolean()
  @IsOptional()
  declare enabled?: boolean;
}
