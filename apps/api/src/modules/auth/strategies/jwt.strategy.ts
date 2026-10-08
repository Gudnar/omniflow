import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@omniflow/types';
import { TenantContextService } from '../../tenant-context/tenant-context.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private tenantContext: TenantContextService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || '',
    });
  }

  validate(payload: JwtPayload) {
    this.tenantContext.setContext({
      tenantId: payload.tenantId,
      userId: payload.sub,
    });

    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      branchIds: payload.branchIds,
    };
  }
}
