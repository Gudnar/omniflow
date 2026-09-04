import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  declare tenantName: string;

  @IsEmail()
  declare email: string;

  @IsString()
  @MinLength(12)
  declare password: string;
}

export class LoginDto {
  @IsEmail()
  declare email: string;

  @IsString()
  declare password: string;
}

export class RefreshTokenDto {
  @IsString()
  declare refreshToken: string;
}

export class MfaVerifyDto {
  @IsString()
  declare mfaChallengeToken: string;

  @IsString()
  @MinLength(6)
  declare code: string;
}

export class MfaEnrollVerifyDto {
  @IsString()
  @MinLength(6)
  declare code: string;
}
