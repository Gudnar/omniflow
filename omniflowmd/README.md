# OmniFlow

SaaS multi-tenant para CRM, conversaciones omnicanal, agentes IA, ecommerce conversacional, reservas, automatización y analítica.

## Flujo central
Cliente → WhatsApp → Agente IA → Ecommerce conversacional → Carrito → Pedido/Reserva → gestión manual → eventos → Agente IA → proceso restante.

## Ecommerce
Es un configurador de la experiencia comercial, no un POS. Configura apariencia, portada, catálogo, sucursales, carrito, checkout, ubicación, pagos, fulfillment y conexión con IA.

Modos: `DIRECT_SALE`, `RESERVATION`, `SALE_AND_RESERVATION`.

Ubicación: `WHATSAPP`, `STOREFRONT`, `BOTH`, `NONE`.

## Operación
Compras confirmadas se gestionan en `Pedidos`; reservas en `Reservas/Citas`. Fulfillment desacoplado permite Pickup, Delivery y Shipping.

## Delivery futuro
La arquitectura soporta zonas, tarifas, repartidores, proveedores externos, tracking, rutas y automatización. Inicialmente se gestiona manualmente mediante rutas del día.

## Documentos
PROJECT_SPEC, ARCHITECTURE, DATABASE, SECURITY, UX_UI, CONVERSATIONAL_ECOMMERCE, AI_SPEC, EVENTS_AND_WORKFLOWS, API_CONTRACTS, DEPLOYMENT, IMPLEMENTATION_PLAN, CODEX_START_PROMPT.
