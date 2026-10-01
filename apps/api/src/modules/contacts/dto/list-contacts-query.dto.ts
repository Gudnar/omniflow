import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ContactType, ContactStatus } from '@omniflow/database';

export class ListContactsQueryDto {
  @IsEnum(ContactStatus)
  @IsOptional()
  declare status?: ContactStatus;

  @IsEnum(ContactType)
  @IsOptional()
  declare type?: ContactType;

  @IsString()
  @IsOptional()
  declare companyId?: string;

  @IsString()
  @IsOptional()
  declare search?: string;
}
