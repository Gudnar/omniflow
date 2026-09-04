import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export declare class PrismaService implements OnModuleInit, OnModuleDestroy {
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    $queryRaw: <T = unknown>(query: TemplateStringsArray | import("packages/database/src/prisma/runtime/library").Sql, ...values: any[]) => import("packages/database/src/prisma").Prisma.PrismaPromise<T>;
    $executeRaw: <T = unknown>(query: TemplateStringsArray | import("packages/database/src/prisma/runtime/library").Sql, ...values: any[]) => import("packages/database/src/prisma").Prisma.PrismaPromise<number>;
}
//# sourceMappingURL=prisma.service.d.ts.map