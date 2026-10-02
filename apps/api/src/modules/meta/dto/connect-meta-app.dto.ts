import { IsString, MinLength, IsOptional } from 'class-validator';

export class ConnectMetaAppDto {
  @IsString()
  @MinLength(1)
  declare appId: string;

  // Optional so an already-connected App can be edited (fixing the App ID)
  // without forcing the operator to re-paste the secret — same convention as
  // ConnectMetaDto.accessToken.
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare appSecret?: string;
}
