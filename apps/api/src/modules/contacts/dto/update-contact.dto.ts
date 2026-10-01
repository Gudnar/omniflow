import { IsString, IsEmail, IsOptional, MinLength, IsEnum } from 'class-validator';
import { ContactType, ContactStatus, ContactSource } from '@omniflow/database';

export class UpdateContactDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsEmail()
  @IsOptional()
  declare email?: string;

  @IsString()
  @IsOptional()
  declare phone?: string;

  @IsEnum(ContactType)
  @IsOptional()
  declare type?: ContactType;

  @IsEnum(ContactStatus)
  @IsOptional()
  declare status?: ContactStatus;

  @IsEnum(ContactSource)
  @IsOptional()
  declare source?: ContactSource;

  @IsString()
  @IsOptional()
  declare companyId?: string;

  @IsString()
  @IsOptional()
  declare ownerId?: string;
}
