# Security

Zero trust: todo request, webhook, archivo, mensaje, documento, tool input y proveedor externo es no confiable hasta validarse.

## Tenant
Resolver tenant desde sesión/token; nunca aceptar tenant_id del cliente como autoridad. Aplicar filtros obligatorios y considerar RLS.

## Auth/AuthZ
Argon2id, MFA para administradores, refresh rotation, sesiones revocables, recuperación segura, protección credential stuffing. RBAC + scopes GLOBAL/TENANT/BRANCH/TEAM/OWN.

## API
DTO validation, límites, rate limit, paginación, timeout, idempotency keys, errores sin secretos.

## Commerce
Servidor recalcula precio, promociones, stock, impuestos, delivery fee y total. Nunca confiar en frontend/IA.

## AI
Tool Policy → Authorization → Validation → Domain Service → DB/API. No SQL/shell/filesystem/Redis arbitrario. RAG aislado por tenant.

## Webhooks
Firma, timestamp, event ID, idempotencia y replay protection.

## Location
Solicitar solo cuando sea necesario/configurado. Guardar mínimo necesario y aplicar controles/retención.

## Delivery
IA no cambia tarifas, rutas, asignaciones o estados críticos fuera de servicios autorizados.

## Files/Infra
Validar MIME/tamaño, almacenamiento seguro, URLs firmadas; TLS, firewall, SSH keys, usuario no root, secrets, backups, monitoring, dependency scanning.

## Audit
Permisos, precios, promociones, pedidos, pagos, inventario, configuración ecommerce, rutas, asignaciones y estados sensibles.

## Tests
Tenant isolation, IDOR/BOLA, authz, validación, rate limit, replay/idempotencia y abuso de tools.
