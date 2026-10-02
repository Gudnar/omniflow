import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpsertAiCredentialDto {
  @IsString()
  @MinLength(1)
  declare apiKey: string;
}

export class TestAiCredentialDto {
  // Optional so an already-configured provider can be re-tested without
  // forcing the operator to re-paste the key — AiCredentialsService.testConnection()
  // keeps the existing key when this is omitted, same convention as
  // ConnectMetaDto.accessToken.
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare apiKey?: string;
}
