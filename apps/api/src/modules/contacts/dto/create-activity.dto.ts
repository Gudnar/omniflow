import { IsEnum, IsString, IsOptional, MinLength, IsDateString } from 'class-validator';
import { ActivityType } from '@omniflow/database';

export class CreateActivityDto {
  @IsEnum(ActivityType)
  declare type: ActivityType;

  @IsString()
  @MinLength(1)
  declare subject: string;

  @IsString()
  @IsOptional()
  declare description?: string;

  @IsDateString()
  @IsOptional()
  declare occurredAt?: string;
}
