import { IsString, IsOptional, IsHexColor, IsUrl, IsEnum, IsBoolean, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { LinkPageStatus } from '@omniflow/database';

// A cleared avatar reaches us as '' (no "unset" state in an HTML text
// input), which @IsUrl() would otherwise reject — same normalization as
// UpdateThemeDto.
const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

export class UpdateLinkPageDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare slug?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare title?: string;

  @IsString()
  @IsOptional()
  declare bio?: string;

  @Transform(emptyToNull)
  @IsUrl({ require_tld: false })
  @IsOptional()
  declare avatarUrl?: string | null;

  @IsEnum(LinkPageStatus)
  @IsOptional()
  declare status?: LinkPageStatus;

  @IsHexColor()
  @IsOptional()
  declare primaryColor?: string;

  @IsHexColor()
  @IsOptional()
  declare backgroundColor?: string;

  @IsHexColor()
  @IsOptional()
  declare textColor?: string;

  @IsBoolean()
  @IsOptional()
  declare chatEnabled?: boolean;
}
