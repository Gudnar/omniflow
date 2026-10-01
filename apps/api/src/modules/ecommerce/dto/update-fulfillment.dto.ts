import { IsArray, IsEnum } from 'class-validator';
import { FulfillmentType } from '@omniflow/database';

export class UpdateFulfillmentDto {
  @IsArray()
  @IsEnum(FulfillmentType, { each: true })
  declare fulfillmentOptions: FulfillmentType[];
}
