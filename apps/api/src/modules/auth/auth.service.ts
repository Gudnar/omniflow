import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import * as otplibModule from 'otplib';
import { toDataURL } from 'qrcode';

const authenticator = (otplibModule as any).authenticator;
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { RolesService } from '../roles/roles.service';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '@omniflow/utils';
import { RegisterDto, LoginDto, RefreshTokenDto } from './auth.dto';
import { AuthResponse, MfaEnrollResponse, JwtPayload, AuthTokens } from '@omniflow/types';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  private readonly refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private readonly mfaIssuer = process.env.MFA_ISSUER || 'OmniFlow';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tenantContext: TenantContextService,
    private rolesService: RolesService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.raw.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered', {
        field: 'email',
      });
    }

    const passwordHash = await hash(dto.password);
    let tenantSlug = this.generateSlug(dto.tenantName);

    // Uses the raw (unscoped) client: the tenant doesn't exist yet, so there is
    // no tenant context to scope by. Every operation below sets tenantId explicitly.
    const result = await this.prisma.raw.$transaction(async (tx: any) => {
      let tenant;
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries) {
        try {
          tenant = await tx.tenant.create({
            data: {
              name: dto.tenantName,
              slug: tenantSlug,
            },
          });
          break;
        } catch (error: any) {
          if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
            retries++;
            if (retries >= maxRetries) {
              throw new ConflictError('Unable to create tenant: slug collision', {
                field: 'tenantName',
              });
            }
            const suffix = Math.random().toString(36).substring(7).slice(0, 3);
            tenantSlug = `${this.generateSlug(dto.tenantName)}-${suffix}`;
          } else {
            throw error;
          }
        }
      }

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          tenantId: tenant.id,
          status: 'ACTIVE',
        },
      });

      await this.rolesService.seedDefaultRolesForTenant(tenant.id, tx);

      const ownerRole = await tx.role.findUnique({
        where: { tenantId_name: { tenantId: tenant.id, name: 'OWNER' } },
        include: { permissions: { include: { permission: true } } },
      });

      if (ownerRole) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: ownerRole.id,
          },
        });
      }

      return { tenant, user };
    });

    this.tenantContext.setContext({
      tenantId: result.tenant.id,
      userId: result.user.id,
    });

    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.tenant.id,
    );

    return {
      ...tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        tenantId: result.tenant.id,
        mfaEnabled: result.user.mfaEnabled,
      },
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<AuthResponse | { mfaChallengeToken: string; expiresIn: number }> {
    const user = await this.prisma.raw.user.findUnique({
      where: { email: dto.email },
      include: {
        tenant: true,
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        branches: { select: { branchId: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordValid = await verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.mfaEnabled) {
      const mfaChallengeToken = this.jwtService.sign(
        { sub: user.id, tenantId: user.tenantId, type: 'mfa-challenge' },
        { expiresIn: '5m' },
      );
      return { mfaChallengeToken, expiresIn: 300 };
    }

    this.tenantContext.setContext({
      tenantId: user.tenantId,
      userId: user.id,
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.tenantId,
      user.roles as any,
      user.branches as any,
    );

    const hasAdminRole = (user.roles as any[]).some((ur: any) => ur.role.isSystem);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
      mfaSetupRecommended: hasAdminRole && !user.mfaEnabled,
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const tokenRecord = await this.prisma.raw.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(dto.refreshToken) },
      include: {
        user: {
          include: {
            roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
            branches: { select: { branchId: true } },
          },
        },
      },
    });

    if (
      !tokenRecord ||
      tokenRecord.revokedAt ||
      new Date(tokenRecord.expiresAt) < new Date()
    ) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    this.tenantContext.setContext({
      tenantId: tokenRecord.user.tenantId,
      userId: tokenRecord.user.id,
    });

    const newTokens = await this.generateTokens(
      tokenRecord.user.id,
      tokenRecord.user.email,
      tokenRecord.user.tenantId,
      tokenRecord.user.roles,
      (tokenRecord.user as any).branches,
    );

    // generateTokens() above already persisted a RefreshToken row for
    // newTokens.refreshToken — look it up rather than creating a second row
    // with the same tokenHash (that used to throw a unique-constraint
    // violation on every refresh, since nothing exercised this path before
    // the frontend gained refresh-on-401 logic in Phase 16).
    const newTokenRecord = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(newTokens.refreshToken) },
    });

    await this.prisma.client.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: newTokenRecord?.id,
      },
    });

    return newTokens;
  }

  async logout(userId: string): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    this.tenantContext.setContext({
      tenantId: user.tenantId,
      userId: user.id,
    });

    await this.prisma.client.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async enrollMfa(userId: string): Promise<MfaEnrollResponse> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    if (user.mfaEnabled) {
      throw new ValidationError('MFA is already enabled for this user');
    }

    const secret = authenticator.generateSecret();
    const otpauth_url = authenticator.keyuri(user.email, this.mfaIssuer, secret);
    const qrCode = await toDataURL(otpauth_url);

    const recoveryCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    await this.prisma.client.$transaction(async (tx: any) => {
      for (const code of recoveryCodes) {
        const codeHash = await hash(code);
        await tx.mfaRecoveryCode.create({
          data: {
            userId,
            codeHash,
          },
        });
      }
    });

    return {
      secret,
      qrCode,
      recoveryCodes,
    };
  }

  async verifyMfaEnroll(userId: string, code: string): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new ValidationError('MFA setup not in progress');
    }

    const isValid = authenticator.check(code, user.mfaSecret);
    if (!isValid) {
      throw new ValidationError('Invalid TOTP code');
    }

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
  }

  async verifyMfaLogin(
    mfaChallengeToken: string,
    code: string,
  ): Promise<AuthTokens> {
    let payload: any;
    try {
      payload = this.jwtService.verify(mfaChallengeToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired MFA challenge token');
    }

    if (payload.type !== 'mfa-challenge') {
      throw new UnauthorizedError('Invalid token type');
    }

    this.tenantContext.setContext({
      tenantId: payload.tenantId,
      userId: payload.sub,
    });

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        branches: { select: { branchId: true } },
      },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedError('MFA not enabled for this user');
    }

    const isValidCode = authenticator.check(code, user.mfaSecret);
    if (!isValidCode) {
      const recoveryCode = await this.prisma.client.mfaRecoveryCode.findFirst({
        where: {
          userId: user.id,
          usedAt: null,
        },
      });

      if (!recoveryCode || !(await verify(recoveryCode.codeHash, code))) {
        throw new UnauthorizedError('Invalid TOTP code or recovery code');
      }

      await this.prisma.client.mfaRecoveryCode.update({
        where: { id: recoveryCode.id },
        data: { usedAt: new Date() },
      });
    }

    this.tenantContext.setContext({
      tenantId: user.tenantId,
      userId: user.id,
    });

    return this.generateTokens(
      user.id,
      user.email,
      user.tenantId,
      user.roles,
      (user as any).branches,
    );
  }

  private async generateTokens(
    userId: string,
    email: string,
    tenantId: string,
    userRoles?: any[],
    userBranches?: { branchId: string }[],
  ): Promise<AuthTokens> {
    const roles = userRoles?.map((ur: any) => ur.role.name) || [];
    const permissions = userRoles
      ?.flatMap((ur: any) => ur.role.permissions.map((rp: any) => rp.permission.code)) || [];
    // Empty = unrestricted (every branch) — see UserBranch in the schema.
    const branchIds = userBranches?.map((ub) => ub.branchId) || [];

    const payload: JwtPayload = {
      sub: userId,
      tenantId,
      email,
      roles,
      permissions,
      branchIds,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn as any,
    });

    const refreshTokenValue = randomBytes(32).toString('hex');
    const refreshTokenRecord = await this.prisma.client.refreshToken.create({
      data: {
        userId,
        tenantId,
        tokenHash: this.hashToken(refreshTokenValue),
        expiresAt: this.getExpiresAt(this.refreshTokenExpiresIn),
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getExpiresAt(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([a-z])$/i);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [, value, unit] = match;
    const v = parseInt(value);
    const date = new Date();

    switch (unit.toLowerCase()) {
      case 'm':
        date.setMinutes(date.getMinutes() + v);
        break;
      case 'h':
        date.setHours(date.getHours() + v);
        break;
      case 'd':
        date.setDate(date.getDate() + v);
        break;
      default:
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    return date;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}
