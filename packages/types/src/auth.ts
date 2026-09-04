export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MfaChallengeResponse {
  mfaChallengeToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    tenantId: string;
    mfaEnabled: boolean;
  };
  mfaSetupRecommended?: boolean;
}

export interface MfaEnrollResponse {
  secret: string;
  qrCode: string;
  recoveryCodes: string[];
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
}
