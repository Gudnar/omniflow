import { IsString, IsOptional, IsBoolean, IsInt, IsIn } from 'class-validator';

const PAYMENT_METHOD_TYPES = ['CASH', 'BANK_TRANSFER', 'QR'];

export class CreatePaymentMethodDto {
  @IsIn(PAYMENT_METHOD_TYPES)
  declare type: 'CASH' | 'BANK_TRANSFER' | 'QR';

  @IsString()
  declare label: string;

  @IsBoolean()
  @IsOptional()
  declare enabled?: boolean;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;

  @IsString()
  @IsOptional()
  declare instructions?: string;

  @IsString()
  @IsOptional()
  declare qrImageUrl?: string;
}

export class UpdatePaymentMethodDto {
  @IsIn(PAYMENT_METHOD_TYPES)
  @IsOptional()
  declare type?: 'CASH' | 'BANK_TRANSFER' | 'QR';

  @IsString()
  @IsOptional()
  declare label?: string;

  @IsBoolean()
  @IsOptional()
  declare enabled?: boolean;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;

  @IsString()
  @IsOptional()
  declare instructions?: string;

  @IsString()
  @IsOptional()
  declare qrImageUrl?: string;
}
