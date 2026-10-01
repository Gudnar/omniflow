import { IsString, MinLength, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MinLength(1)
  declare label: string;

  @IsString()
  @MinLength(1)
  declare recipientName: string;

  @IsString()
  @MinLength(1)
  declare phone: string;

  @IsString()
  @MinLength(1)
  declare addressLine: string;

  @IsString()
  @IsOptional()
  declare reference?: string;

  @IsString()
  @IsOptional()
  declare city?: string;

  @IsString()
  @IsOptional()
  declare zone?: string;

  @IsNumber()
  @IsOptional()
  declare latitude?: number;

  @IsNumber()
  @IsOptional()
  declare longitude?: number;

  @IsString()
  @IsOptional()
  declare notes?: string;

  @IsBoolean()
  @IsOptional()
  declare isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare label?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare recipientName?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare phone?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare addressLine?: string;

  @IsString()
  @IsOptional()
  declare reference?: string;

  @IsString()
  @IsOptional()
  declare city?: string;

  @IsString()
  @IsOptional()
  declare zone?: string;

  @IsNumber()
  @IsOptional()
  declare latitude?: number;

  @IsNumber()
  @IsOptional()
  declare longitude?: number;

  @IsString()
  @IsOptional()
  declare notes?: string;

  @IsBoolean()
  @IsOptional()
  declare isDefault?: boolean;
}
