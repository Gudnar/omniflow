import { IsString, MinLength, IsOptional } from 'class-validator';

export class ConnectTikTokDto {
  @IsString()
  @MinLength(1)
  declare businessId: string;

  @IsString()
  @MinLength(1)
  declare clientKey: string;

  // Optional so an already-connected account can be edited without forcing
  // the operator to re-paste both tokens every time — TikTokConnectionService
  // .connect() keeps the existing value when either is omitted, and still
  // requires both on a first connect.
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare accessToken?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare refreshToken?: string;
}
