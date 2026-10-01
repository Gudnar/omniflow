import { IsString, IsOptional, IsHexColor, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

// A cleared image input reaches us as '' (there is no "unset" state in an
// HTML text input), which @IsUrl() would otherwise reject — normalize to
// null (a real clear) before validation runs, instead of trusting the
// client to never send an empty string.
const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

// require_tld: false — @IsUrl()'s default rejects bare hosts like
// "localhost" (no top-level domain), which is exactly what
// StorageService.saveImage() returns in dev (API_PUBLIC_URL defaults to
// http://localhost:<port>). Still a real, well-formed URL check otherwise.
export class UpdateThemeDto {
  @Transform(emptyToNull)
  @IsUrl({ require_tld: false })
  @IsOptional()
  declare logo?: string | null;

  @Transform(emptyToNull)
  @IsUrl({ require_tld: false })
  @IsOptional()
  declare mobileLogo?: string | null;

  @Transform(emptyToNull)
  @IsUrl({ require_tld: false })
  @IsOptional()
  declare favicon?: string | null;

  @Transform(emptyToNull)
  @IsUrl({ require_tld: false })
  @IsOptional()
  declare heroImage?: string | null;

  @Transform(emptyToNull)
  @IsUrl({ require_tld: false })
  @IsOptional()
  declare mobileHeroImage?: string | null;

  @IsHexColor()
  @IsOptional()
  declare primaryColor?: string;

  @IsHexColor()
  @IsOptional()
  declare secondaryColor?: string;

  @IsHexColor()
  @IsOptional()
  declare buttonColor?: string;

  @IsHexColor()
  @IsOptional()
  declare textColor?: string;

  @IsHexColor()
  @IsOptional()
  declare backgroundColor?: string;

  @IsHexColor()
  @IsOptional()
  declare promoColor?: string;

  @IsString()
  @IsOptional()
  declare fontFamily?: string;
}
