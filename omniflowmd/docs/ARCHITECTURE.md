# Architecture

## Infraestructura
CDN/WAF → Nginx/LB → API stateless → Auth/Tenant Guard/Rate Limit → Domain Services → PostgreSQL / Redis / S3.

Workers separados para mensajes, IA, transcription, vision, embeddings, workflows, campaigns, ecommerce, booking y analytics.

## Monorepo
apps/web, apps/api, apps/worker, apps/scheduler
packages/ui, types, config, database, utils

## Módulos
Auth, Tenants, Users, RolesPermissions, Branches, Contacts, Conversations, Messages, Channels, WhatsApp, Instagram, Facebook, TikTok, AIEngine, AIProviders, Agents, Knowledge, Workflows, Campaigns, Templates, Products, Categories, Subcategories, Variants, Packs, Promotions, Inventory, Carts, Orders, Payments, Booking, Services, Resources, Schedules, Availability, Fulfillment, Delivery, Analytics, Billing, Webhooks.

## Flujo
Webhook → validar firma → resolver tenant → idempotencia → persistir mínimo → evento → cola → worker → AI/Workflow/Commerce → salida.

## Ecommerce conversacional
Conversation → CommerceSession → Storefront → Catalog → Cart → Checkout → Order/Appointment → Event Bus → Agent/Workflow.

## Fulfillment
Order/Appointment usan una capa abstracta. Delivery no debe contaminar Order con detalles de proveedor.

## Delivery futuro
Interface conceptual:
`quote()`, `checkCoverage()`, `createDelivery()`, `assign()`, `updateStatus()`, `cancel()`, `track()`.
Adapters: OwnFleet, ExternalProvider, Aggregator.

## Escalabilidad
Colas por dominio, backpressure, retries con jitter, DLQ, circuit breakers, rate limits por tenant, índices compuestos, Redis cache, agregaciones para analytics.
