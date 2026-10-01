import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex value like #22c55e' })
  declare color?: string;
}

export class UpdateTagDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex value like #22c55e' })
  declare color?: string;
}
