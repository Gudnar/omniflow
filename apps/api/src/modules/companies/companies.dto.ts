import { IsString, IsOptional, MinLength, IsEmail, IsUrl } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsString()
  @IsOptional()
  declare industry?: string;

  @IsUrl()
  @IsOptional()
  declare website?: string;

  @IsString()
  @IsOptional()
  declare phone?: string;

  @IsEmail()
  @IsOptional()
  declare email?: string;

  @IsString()
  @IsOptional()
  declare address?: string;
}

export class UpdateCompanyDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsString()
  @IsOptional()
  declare industry?: string;

  @IsUrl()
  @IsOptional()
  declare website?: string;

  @IsString()
  @IsOptional()
  declare phone?: string;

  @IsEmail()
  @IsOptional()
  declare email?: string;

  @IsString()
  @IsOptional()
  declare address?: string;
}
