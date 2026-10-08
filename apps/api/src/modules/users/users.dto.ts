import { IsEmail, IsString, MinLength, IsArray, ArrayUnique, IsOptional, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  declare email: string;

  @IsString()
  @MinLength(8)
  declare password: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  declare roleIds: string[];

  // Empty = unrestricted (manages every branch) — see UserBranch.
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  declare branchIds: string[];
}

export class UpdateUserDto {
  @IsIn(['ACTIVE', 'DISABLED'])
  @IsOptional()
  declare status?: 'ACTIVE' | 'DISABLED';

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  declare roleIds?: string[];

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  declare branchIds?: string[];
}
