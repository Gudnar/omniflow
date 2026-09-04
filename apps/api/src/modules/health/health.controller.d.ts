import { HealthService } from './health.service';
import { HealthCheckResponse } from '@omniflow/types';
export declare class HealthController {
    private healthService;
    constructor(healthService: HealthService);
    check(): Promise<HealthCheckResponse>;
}
//# sourceMappingURL=health.controller.d.ts.map