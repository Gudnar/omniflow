import { IsString, IsOptional, IsUrl, IsInt, IsBoolean } from 'class-validator';

export class CreateProductMediaDto {
  @IsUrl()
  declare url: string;

  @IsString()
  @IsOptional()
  declare altText?: string;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  declare isPrimary?: boolean;
}

export class UpdateProductMediaDto {
  @IsUrl()
  @IsOptional()
  declare url?: string;

  @IsString()
  @IsOptional()
  declare altText?: string;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  declare isPrimary?: boolean;
}
