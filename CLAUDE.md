# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OmniFlow** is a multi-tenant SaaS platform for:
- **CRM & Omnichannel**: Contact management, conversations across WhatsApp, Instagram, Facebook, TikTok
- **AI Agents**: Autonomous agents with tools, RAG, memory, and workflows
- **Conversational eCommerce**: Product catalog, carts, orders, and checkout integrated with AI agents
- **Booking System**: Services, resources, schedules, appointments with availability management
- **Fulfillment**: Pickup, local delivery, and shipping with manual route management (advanced delivery is future)
- **Analytics & Automation**: Event-driven workflows, campaigns, and real-time metrics

**Central flow**: Client → WhatsApp → AI Agent → Conversational Commerce → Cart → Order/Reservation → Manual operations → Events → Workflows/Agent.

## Tech Stack

- **Frontend**: Next.js + React + TypeScript + Tailwind CSS + shadcn/ui + Lucide icons
- **Backend**: NestJS + TypeScript + Prisma ORM
- **Database**: PostgreSQL + pgvector (embeddings)
- **Cache/Queues**: Redis + BullMQ
- **Storage**: S3-compatible object storage
- **Real-time**: Socket.IO
- **Monorepo**: pnpm + Turborepo
- **Deployment**: Linux + Nginx + PM2

## Architecture

```
CDN/WAF → Nginx/LB → Stateless API → Auth/TenantGuard/RateLimit → Domain Services → PostgreSQL/Redis/S3

Separate workers for: messages, AI, transcription, vision, embeddings, workflows, campaigns, ecommerce, booking, analytics
```

### Monorepo Structure

```
apps/
  web/          # Next.js frontend
  api/          # NestJS backend
  worker/       # Background job processor (BullMQ)
  scheduler/    # Cron jobs and scheduled tasks

packages/
  ui/           # React component library (shadcn/ui, Lucide)
  types/        # Shared TypeScript types
  config/       # Shared configuration (tsconfig, eslint, etc.)
  database/     # Prisma schema and migrations
  utils/        # Shared utilities
```

### Core Modules

**Foundation**: Auth, Tenants, Users, Roles/Permissions, Branches

**CRM**: Contacts, Companies, Conversations, Messages, Attachments, Tags, Notes, Activities

**Channels**: WhatsApp, Instagram, Facebook, TikTok (integrate via webhooks)

**Commerce**:
- Configuration: `ecommerce_stores`, `ecommerce_store_settings`, `ecommerce_themes`, `ecommerce_sections`
- Catalog: `categories`, `subcategories`, `products`, `product_variants`, `product_media`, `branch_products`
- Operations: `commerce_sessions`, `carts`, `cart_items`, `orders`, `order_items`, `customer_addresses`

**Booking**: Services, resources, schedules, availability, appointments

**Fulfillment**: Abstract layer supporting PICKUP, LOCAL_DELIVERY, SHIPPING

**AI**: Providers, models, agents, tools, knowledge documents, embeddings, memory

**Other**: Inventory, workflows, campaigns, templates, payments, analytics, billing, webhooks

## Mandatory Principles

1. **Multi-tenancy from day one**: Every data model includes `tenant_id`. Tenant resolved from session/token, never from client input.
2. **Stateless API**: No server-side session state; use JWT or similar.
3. **Fast webhooks**: Validate signature → resolve tenant → idempotency check → persist minimum → emit event → queue → worker.
4. **Idempotence**: Webhooks, orders, payments, inventory, appointments, external actions must be idempotent.
5. **Trust boundary**: Never trust `tenant_id`, prices, discounts, stock, delivery fees, totals from client.
6. **Conversational commerce**: Ecommerce integrates with and is driven by AI agents.
7. **Cart vs Order vs Appointment**: Cart = mutable intent; Order = confirmed purchase; Appointment = confirmed reservation.
8. **Fulfillment abstraction**: Order/Appointment use a decoupled fulfillment layer; no provider-specific leakage.
9. **AI tools are authorized**: No arbitrary SQL, shell, filesystem, or Redis access. All tool input validated before domain service.
10. **Security is cross-cutting**: Applies to auth, API, commerce pricing, AI tools, webhooks, location data, delivery operations, files, and audit.

## Definition of Done

A feature is complete when it includes:
- Business logic implementation
- Authorization checks (RBAC + scope validation)
- Tenant isolation enforcement
- Input/DTO validation
- Error handling with no secret leakage
- Idempotence (where applicable)
- Audit logging (for sensitive operations)
- Unit + integration tests
- TypeScript type checking
- Linting and build passes
- Updated documentation

## Development Workflow

### Setup (Phase 1 Foundation)

Currently, the project is in the **documentation and planning phase**. Code generation will begin with Phase 1: Foundation.

Expected initial setup commands (pending implementation):
```bash
# Install dependencies
pnpm install

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build all apps and packages
pnpm build

# Run tests
pnpm test

# Run API server (development)
cd apps/api && pnpm dev

# Run Next.js frontend
cd apps/web && pnpm dev

# Run worker
cd apps/worker && pnpm dev

# Run single test file
pnpm test -- path/to/test.spec.ts
```

### Database

- **ORM**: Prisma (`packages/database/prisma/schema.prisma`)
- **Migrations**: `pnpm db:migrate` (pending implementation)
- **Seed**: Development seed data via migrations or seed scripts
- **Postgres + pgvector**: Vector embeddings for RAG and AI memory

### Creating a Feature

1. **Read documentation first**: Start with relevant docs in `omniflowmd/docs/` and this CLAUDE.md.
2. **Plan the phase**: Confirm which implementation phase covers the feature (see IMPLEMENTATION_PLAN.md).
3. **Database schema**: Update `packages/database/prisma/schema.prisma` with models, add indexes, migrations.
4. **API layer** (NestJS): Controllers, services, DTOs, guards, error handling, validation.
5. **Frontend** (Next.js): Pages, components, API hooks, state management.
6. **Tests**: Unit tests for business logic, integration tests for API endpoints.
7. **Security**: Tenant isolation, authorization, input validation, audit logging.
8. **Idempotence**: If webhook-driven, implement idempotency keys and replay protection.
9. **Compliance**: Ensure multi-tenancy, no secret leakage, no arbitrary AI tool access.

## Security Checklist

- **Tenant resolution**: Extract `tenant_id` from JWT or authenticated session, never from request body/params.
- **Authorization**: Apply RBAC guards (GLOBAL, TENANT, BRANCH, TEAM, OWN scopes).
- **Input validation**: DTO validation on all incoming data; sanitize before storing/rendering.
- **Commerce recalculation**: Server-side recalc of price, promotions, stock, tax, delivery, total; never trust frontend.
- **AI tools**: Enforce Tool Policy → Authorization → Validation before domain service call.
- **Webhooks**: Verify signature, check timestamp, enforce idempotency key, prevent replay.
- **Audit logging**: Log permission changes, price/promotion edits, order state, payment actions, inventory moves, sensitive configs.
- **Secrets**: Use environment variables; never commit API keys, DB credentials, or tokens.
- **Location data**: Request only if necessary/configured; store minimum; apply retention policies.

## Key Architecture Patterns

### Webhook Flow

```
Webhook request → Verify signature → Resolve tenant → Check idempotency key → Persist event → Emit to event bus → Queue job
```

### Commerce Flow

```
Conversation → CommerceSession → Storefront (config) → Catalog → Cart (mutable) → Checkout → Order (final) → Event Bus → Fulfillment/Workflows
```

### AI Agent Interaction

```
User message → AI Agent (reads tools) → Tool Authorization → Tool Validation → Domain Service → DB/API → Response → Event Bus
```

### Fulfillment Abstraction

Order and Appointment both reference Fulfillment(type: PICKUP|LOCAL_DELIVERY|SHIPPING). Delivery providers adapt to this interface; no provider-specific logic in order/appointment models.

## Implementation Phases

See `omniflowmd/docs/IMPLEMENTATION_PLAN.md` for the full roadmap. Current phase guidance is in `omniflowmd/docs/CODEX_START_PROMPT.md`.

Key phases:
- **Phase 0**: Discovery (documentation)
- **Phase 1**: Foundation (monorepo, Next.js, NestJS, Prisma, Redis, workers, CI)
- **Phase 2–6**: Auth, multi-tenancy, CRM, conversations, WhatsApp
- **Phase 7–11**: Ecommerce (foundation, products, cart, orders)
- **Phase 12–15**: Booking, AI (foundation, commerce, RAG)
- **Phase 16–29**: Workflows, delivery (manual then advanced), analytics, production hardening

Do not implement features beyond the current phase without explicit direction.

## Documentation Reference

All architectural and domain documentation lives in `omniflowmd/docs/`:

- **ARCHITECTURE.md**: Infrastructure, workers, modules, flows, scalability
- **DATABASE.md**: Schema design, multi-tenancy, indexes
- **SECURITY.md**: Zero-trust, tenant resolution, auth, webhooks, AI tools, audit
- **DOMAIN_RULES.md**: Cart vs Order, Appointment, Fulfillment abstraction, Branch rules
- **PROJECT_SPEC.md**: Goals, platform pillars
- **CONVERSATIONAL_ECOMMERCE.md**: Commerce + AI integration
- **AI_SPEC.md**: Agent capabilities, tool policies, memory
- **EVENTS_AND_WORKFLOWS.md**: Event-driven system, automation
- **API_CONTRACTS.md**: Public API boundaries
- **DEPLOYMENT.md**: Infrastructure requirements
- **IMPLEMENTATION_PLAN.md**: Phase breakdown and roadmap

Always refer to these before implementing or making architectural decisions.

## Development Constraints

- Do not delete code without justification (reference AGENTS.md).
- Do not implement speculative dependencies.
- Security and multi-tenancy are non-negotiable.
- Maintain prepared interfaces for CommerceSession, Fulfillment, and Delivery (even if not fully implemented yet).
- Observe phase boundaries; do not implement features from future phases.
- Test tenant isolation, authorization, idempotence, and abuse scenarios in all tests.

## Contributing

1. Read this file and all docs before implementing.
2. Understand the current phase and its scope.
3. Follow the Definition of Done.
4. Ensure tenant isolation and security at every layer.
5. Test edge cases: empty state, concurrent operations, replay attacks, tenant boundary violations.
6. Update relevant documentation if domain rules or architecture changes.
7. Validate that your changes work in the full system (run `pnpm build` and `pnpm test`).
