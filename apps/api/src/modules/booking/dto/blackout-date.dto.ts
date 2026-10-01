import { IsString, IsOptional, IsDateString } from 'class-validator';

export class ListBlackoutDatesQueryDto {
  @IsString()
  declare branchId: string;
}

export class CreateBlackoutDateDto {
  @IsString()
  declare branchId: string;

  @IsDateString()
  declare date: string;

  @IsString()
  @IsOptional()
  declare reason?: string;
}
