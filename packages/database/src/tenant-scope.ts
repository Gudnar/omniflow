import { Prisma } from './prisma';

const TENANT_SCOPED_MODELS = ['User', 'Role', 'RefreshToken', 'Branch'];

type OperationArgs = Record<string, unknown>;

export function createTenantScopedExtension(
  getTenantId: () => string | undefined,
) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: { model: string; operation: string; args: OperationArgs; query: (args: OperationArgs) => Promise<unknown> }) {
            if (!TENANT_SCOPED_MODELS.includes(model)) {
              return query(args);
            }

            const tenantId = getTenantId();
            // Fail-closed: raise error if tenant context is missing for read/update/delete operations.
            // Only `create` is allowed without context since the tenantId is provided in the data.
            if (!tenantId && !['create', 'createMany'].includes(operation)) {
              throw new Error(`Tenant context is required for ${operation} operation on model ${model}`);
            }

            // Inyectar tenantId en operaciones de lectura
            if (
              [
                'findUnique',
                'findUniqueOrThrow',
                'findFirst',
                'findFirstOrThrow',
                'findMany',
                'count',
                'aggregate',
              ].includes(operation)
            ) {
              const modifiedArgs = { ...args };
              if (typeof modifiedArgs.where === 'object' && modifiedArgs.where !== null) {
                modifiedArgs.where = {
                  ...(modifiedArgs.where as OperationArgs),
                  tenantId,
                };
              } else {
                modifiedArgs.where = { tenantId };
              }
              return query(modifiedArgs);
            }

            // Inyectar tenantId en operaciones de escritura
            if (operation === 'create') {
              const modifiedArgs = { ...args };
              if (typeof modifiedArgs.data === 'object' && modifiedArgs.data !== null) {
                modifiedArgs.data = {
                  ...(modifiedArgs.data as OperationArgs),
                  tenantId,
                };
              } else {
                modifiedArgs.data = { tenantId };
              }
              return query(modifiedArgs);
            }

            if (operation === 'createMany') {
              const modifiedArgs = { ...args };
              if (Array.isArray(modifiedArgs.data)) {
                modifiedArgs.data = modifiedArgs.data.map((item: OperationArgs) => ({
                  ...item,
                  tenantId,
                }));
              }
              return query(modifiedArgs);
            }

            // Inyectar tenantId en operaciones de actualización
            if (['update', 'updateMany'].includes(operation)) {
              const modifiedArgs = { ...args };
              if (typeof modifiedArgs.where === 'object' && modifiedArgs.where !== null) {
                modifiedArgs.where = {
                  ...(modifiedArgs.where as OperationArgs),
                  tenantId,
                };
              } else {
                modifiedArgs.where = { tenantId };
              }
              return query(modifiedArgs);
            }

            // Inyectar tenantId en operaciones de eliminación
            if (['delete', 'deleteMany'].includes(operation)) {
              const modifiedArgs = { ...args };
              if (typeof modifiedArgs.where === 'object' && modifiedArgs.where !== null) {
                modifiedArgs.where = {
                  ...(modifiedArgs.where as OperationArgs),
                  tenantId,
                };
              } else {
                modifiedArgs.where = { tenantId };
              }
              return query(modifiedArgs);
            }

            // Inyectar tenantId en operaciones upsert
            if (operation === 'upsert') {
              const modifiedArgs = { ...args };
              if (typeof modifiedArgs.where === 'object' && modifiedArgs.where !== null) {
                modifiedArgs.where = {
                  ...(modifiedArgs.where as OperationArgs),
                  tenantId,
                };
              } else {
                modifiedArgs.where = { tenantId };
              }
              if (typeof modifiedArgs.create === 'object' && modifiedArgs.create !== null) {
                modifiedArgs.create = {
                  ...(modifiedArgs.create as OperationArgs),
                  tenantId,
                };
              }
              if (typeof modifiedArgs.update === 'object' && modifiedArgs.update !== null) {
                // update path doesn't need tenantId in data, only in where
              }
              return query(modifiedArgs);
            }

            return query(args);
          },
        },
      },
    }),
  );
}
