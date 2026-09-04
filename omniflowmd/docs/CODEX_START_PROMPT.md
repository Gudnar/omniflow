# Codex Start Prompt

Lee primero:
AGENTS.md y todos los archivos de `docs/`.

Inspecciona el repositorio existente.

## Objetivo inicial
Implementar únicamente Phase 1 — Foundation:
- monorepo;
- Next.js;
- NestJS;
- worker/scheduler skeleton;
- shared packages;
- Prisma/PostgreSQL;
- Redis/BullMQ;
- configuración;
- logging;
- error handling;
- health endpoint;
- CI/typecheck/lint/build/tests.

No implementar todavía CRM, WhatsApp, IA, Ecommerce completo, Booking o Delivery.

## Restricciones
No borrar código existente. Seguridad y multi-tenancy son obligatorios. Mantener interfaces preparadas para CommerceSession, Fulfillment y Delivery futuro. Evitar dependencias especulativas.

## Validación
Ejecutar install, typecheck, lint, build, tests y validaciones Prisma disponibles.

## Reporte
Entregar resumen, archivos creados/modificados, dependencias, comandos, resultados, errores, decisiones y siguiente fase. Detenerse al terminar la fase solicitada.
