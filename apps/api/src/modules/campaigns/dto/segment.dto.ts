import { IsArray, IsEnum, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ContactStatus, ContactType } from '@omniflow/database';

// A plain AND-of-fields filter mirroring ContactsService.list's existing
// shape — not a full query builder, a stated simplification.
export class SegmentFilterDto {
  @IsOptional() @IsEnum(ContactStatus) declare status?: ContactStatus;
  @IsOptional() @IsEnum(ContactType) declare type?: ContactType;
  @IsOptional() @IsArray() @IsString({ each: true }) declare tagIds?: string[];
}

export class CreateSegmentDto {
  @IsString() @MinLength(1) declare name: string;
  @IsOptional() @IsString() declare description?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SegmentFilterDto)
  declare filterQuery?: SegmentFilterDto;
}

export class UpdateSegmentDto {
  @IsOptional() @IsString() @MinLength(1) declare name?: string;
  @IsOptional() @IsString() declare description?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SegmentFilterDto)
  declare filterQuery?: SegmentFilterDto;
}
