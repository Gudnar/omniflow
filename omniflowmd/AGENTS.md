# OmniFlow — AGENTS.md

## Fuente de verdad
Leer este archivo y todos los documentos de `docs/` antes de implementar. No eliminar código existente sin justificación.

## Stack
Next.js + React + TypeScript + Tailwind + shadcn/ui + Lucide; NestJS + TypeScript + Prisma; PostgreSQL + pgvector; Redis + BullMQ; Socket.IO; S3-compatible; pnpm + Turborepo; Linux + Nginx + PM2.

## Principios obligatorios
- Multi-tenancy desde el inicio.
- API stateless.
- Webhooks rápidos; IA y trabajos pesados en colas.
- Idempotencia para webhooks, pedidos, pagos, inventario, citas y acciones externas.
- Nunca confiar en `tenant_id` del cliente.
- Precios, descuentos, stock, delivery y totales se calculan en servidor.
- IA usa tools autorizadas; nunca SQL/shell/filesystem arbitrario.
- Ecommerce es conversacional y se integra con el Agente IA.
- Cart = intención mutable; Order = compra confirmada; Appointment = reserva confirmada.
- Fulfillment desacoplado: PICKUP, LOCAL_DELIVERY, SHIPPING.
- Delivery avanzado es futuro; la primera versión permite gestión manual de rutas.
- Ubicación configurable: WhatsApp, Ecommerce, ambos o no solicitar.
- Seguridad es requisito transversal.

## Definition of Done
Funcionalidad completa = reglas de negocio + autorización + tenant isolation + validación + errores + idempotencia cuando aplique + auditoría + tests + typecheck/lint/build + documentación.

## Arranque
Leer todos los MD, inspeccionar el repositorio, implementar solo la fase indicada por `CODEX_START_PROMPT.md`, validar y reportar cambios, dependencias, comandos, resultados, errores y decisiones.
