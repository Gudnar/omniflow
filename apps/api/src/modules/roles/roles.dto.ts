import { IsString, MinLength, IsArray, ArrayUnique, IsOptional } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  declare permissionCodes: string[];
}

export class UpdateRoleDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  declare permissionCodes?: string[];
}
