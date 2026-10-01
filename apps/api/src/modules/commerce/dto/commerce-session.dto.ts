import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  declare contactId: string;

  @IsString()
  @IsOptional()
  declare conversationId?: string;

  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsObject()
  @IsOptional()
  declare metadata?: Record<string, unknown>;
}

export class SessionLocationDto {
  @IsNumber()
  declare latitude: number;

  @IsNumber()
  declare longitude: number;

  @IsString()
  @IsOptional()
  declare address?: string;
}
