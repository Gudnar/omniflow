import { IsString, IsOptional, MinLength, IsIn, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateTenantDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsString()
  @IsOptional()
  declare taxId?: string;

  @IsString()
  @IsOptional()
  declare description?: string;

  @IsString()
  @IsOptional()
  declare logo?: string;

  @IsString()
  @IsOptional()
  declare timezone?: string;

  @IsIn(['es', 'en'])
  @IsOptional()
  declare language?: string;

  @IsIn(['BOB', 'USD'])
  @IsOptional()
  declare currency?: string;

  @IsIn(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
  @IsOptional()
  declare dateFormat?: string;

  @IsIn(['12h', '24h'])
  @IsOptional()
  declare timeFormat?: string;

  @IsIn([',', '.'])
  @IsOptional()
  declare decimalSeparator?: string;

  @IsIn(['.', ','])
  @IsOptional()
  declare thousandsSeparator?: string;

  @IsIn(['AUTOMATIC', 'MANUAL'])
  @IsOptional()
  declare orderApprovalMode?: string;

  @IsIn(['AUTOMATIC', 'MANUAL'])
  @IsOptional()
  declare appointmentApprovalMode?: string;

  @IsBoolean()
  @IsOptional()
  declare notifyOnOrderPendingApproval?: boolean;

  @IsBoolean()
  @IsOptional()
  declare notifyOnAppointmentPendingApproval?: boolean;

  @IsBoolean()
  @IsOptional()
  declare notifyOnOrderConfirmed?: boolean;

  @IsBoolean()
  @IsOptional()
  declare notifyOnAppointmentConfirmed?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  declare whatsappFreeWindowHours?: number;

  @IsBoolean()
  @IsOptional()
  declare sendAppointmentQrCode?: boolean;

  @IsBoolean()
  @IsOptional()
  declare sendAppointmentReceiptImage?: boolean;

  @IsBoolean()
  @IsOptional()
  declare sendOrderQrCode?: boolean;

  @IsBoolean()
  @IsOptional()
  declare sendOrderReceiptImage?: boolean;
}
