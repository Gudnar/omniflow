import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleIntervalDto {
  @IsInt()
  @Min(0)
  @Max(6)
  declare dayOfWeek: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  declare startMinute: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  declare endMinute: number;
}

export class UpdateUserScheduleDto {
  @IsString()
  @IsOptional()
  declare name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  declare intervals: ScheduleIntervalDto[];
}

export class CreateTimeOffDto {
  @IsString()
  declare startAt: string;

  @IsString()
  declare endAt: string;

  @IsString()
  @IsOptional()
  declare reason?: string;
}
