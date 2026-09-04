# API Contracts

Tenant desde contexto autenticado. DTOs estrictos. Errores estandarizados.

## Ecommerce
GET /ecommerce/store
PATCH /ecommerce/store
POST /ecommerce/store/publish
GET /ecommerce/preview
PATCH /ecommerce/theme
PATCH /ecommerce/sections
PATCH /ecommerce/navigation
PATCH /ecommerce/checkout
PATCH /ecommerce/location
PATCH /ecommerce/fulfillment

## Commerce
POST /commerce/sessions
GET /commerce/sessions/:id
POST /commerce/sessions/:id/cart
GET /carts/:id
POST /carts/:id/items
PATCH /carts/:id/items/:itemId
DELETE /carts/:id/items/:itemId
POST /carts/:id/validate
POST /carts/:id/checkout

## Orders
GET /orders
GET /orders/:id
POST /orders/:id/confirm
POST /orders/:id/cancel
POST /orders/:id/status
POST /orders/:id/fulfillment

## Booking
GET /booking/services
GET /booking/availability
POST /appointments
PATCH /appointments/:id
POST /appointments/:id/cancel

## Location
POST /contacts/:id/addresses
GET /contacts/:id/addresses
POST /commerce/sessions/:id/location

## Manual routes/future delivery
GET /delivery/routes
POST /delivery/routes
GET /delivery/routes/:id
PATCH /delivery/routes/:id
POST /delivery/routes/:id/stops
PATCH /delivery/routes/:id/stops/reorder
POST /delivery/routes/:id/start
POST /delivery/routes/:id/complete

## Rules
Idempotency en side effects; cursor pagination; authz por recurso/scope; servidor como autoridad de precio/stock.
