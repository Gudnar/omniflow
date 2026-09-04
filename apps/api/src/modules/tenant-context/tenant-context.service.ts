import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

export interface TenantContextData {
  tenantId: string;
  userId: string;
}

@Injectable()
export class TenantContextService {
  constructor(private cls: ClsService) {}

  setContext(data: TenantContextData): void {
    this.cls.set('tenantId', data.tenantId);
    this.cls.set('userId', data.userId);
  }

  getTenantId(): string | undefined {
    return this.cls.get('tenantId');
  }

  getUserId(): string | undefined {
    return this.cls.get('userId');
  }

  getContext(): Partial<TenantContextData> {
    return {
      tenantId: this.getTenantId(),
      userId: this.getUserId(),
    };
  }
}
