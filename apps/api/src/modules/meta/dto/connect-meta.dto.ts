import { IsString, MinLength, IsOptional } from 'class-validator';

export class ConnectMetaDto {
  @IsString()
  @MinLength(1)
  declare externalAccountId: string;

  // Optional so an already-connected channel can be edited (display name,
  // WABA ID, etc.) without forcing the operator to re-paste the access
  // token every time — MetaConnectionService.connect() keeps the existing
  // token when this is omitted, and still requires it on a first connect.
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare accessToken?: string;

  @IsString()
  @MinLength(1)
  declare displayName: string;

  // Only meaningful for WhatsApp; ignored for Instagram/Facebook connections.
  @IsString()
  @IsOptional()
  declare wabaId?: string;
}
