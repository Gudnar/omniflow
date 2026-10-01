import { IsString, IsEmail, IsOptional, MinLength, IsEnum, IsArray } from 'class-validator';
import { ContactType, ContactSource } from '@omniflow/database';

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsEmail()
  @IsOptional()
  declare email?: string;

  @IsString()
  @IsOptional()
  declare phone?: string;

  @IsEnum(ContactType)
  @IsOptional()
  declare type?: ContactType;

  @IsEnum(ContactSource)
  @IsOptional()
  declare source?: ContactSource;

  @IsString()
  @IsOptional()
  declare companyId?: string;

  @IsString()
  @IsOptional()
  declare ownerId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare tagIds?: string[];
}
