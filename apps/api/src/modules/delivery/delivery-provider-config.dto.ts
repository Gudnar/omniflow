import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { DeliveryProviderType, DeliveryOperationMode } from '@omniflow/database';

export class UpsertDeliveryProviderConfigDto {
  // Omit for the tenant-wide default; set to override for one branch.
  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsEnum(DeliveryProviderType)
  declare type: DeliveryProviderType;

  // Solo tiene efecto con type TELEGRAM_NOTIFY — OWN_FLEET siempre opera por
  // rutas. Default ROUTE_BASED si se omite.
  @IsEnum(DeliveryOperationMode)
  @IsOptional()
  declare operationMode?: DeliveryOperationMode;

  // TELEGRAM_NOTIFY only.
  @IsString()
  @IsOptional()
  declare chatId?: string;

  // TELEGRAM_NOTIFY only — plaintext in, encrypted before it's stored; omit
  // on an update to keep the existing token unchanged.
  @IsString()
  @IsOptional()
  declare botToken?: string;

  @IsBoolean()
  @IsOptional()
  declare enabled?: boolean;
}
