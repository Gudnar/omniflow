export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    cursor?: string;
    hasMore: boolean;
  };
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
}
