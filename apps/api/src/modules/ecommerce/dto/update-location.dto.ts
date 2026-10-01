import { IsEnum } from 'class-validator';
import { EcommerceLocationSource } from '@omniflow/database';

export class UpdateLocationDto {
  @IsEnum(EcommerceLocationSource)
  declare locationSource: EcommerceLocationSource;
}
