import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  declare name: string;

  @IsString()
  declare phone: string;

  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsString()
  @IsOptional()
  declare notes?: string;
}

export class UpdateDriverDto {
  @IsString()
  @IsOptional()
  declare name?: string;

  @IsString()
  @IsOptional()
  declare phone?: string;

  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  declare status?: 'ACTIVE' | 'INACTIVE';

  @IsString()
  @IsOptional()
  declare notes?: string;
}
