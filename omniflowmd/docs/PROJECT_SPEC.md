# Project Specification

## Objetivo
Plataforma SaaS multi-tenant que centraliza CRM, canales, IA, ecommerce conversacional, reservas, pedidos, automatizaciones y analítica.

## Ecommerce
El administrador configura la experiencia que el cliente recibe, especialmente desde WhatsApp:
- marca, colores, tema y tipografía;
- portada y secciones;
- catálogo;
- sucursales;
- carrito;
- checkout;
- ubicación;
- pagos;
- fulfillment;
- IA.

## Modos
### Venta directa
Catálogo → carrito → confirmación → Order.

### Reserva
Servicio → disponibilidad → selección → confirmación → Appointment.

### Venta + Reserva
Permite ambos flujos y, cuando corresponda, Order + Appointment.

## Gestión
Order confirmado → módulo Pedidos.
Appointment confirmado → módulo Reservas/Citas.
El operador puede procesar manualmente.

## Fulfillment
PICKUP, LOCAL_DELIVERY, SHIPPING.

## Ubicación
WHATSAPP, STOREFRONT, BOTH o NONE.

## Rutas
La primera versión permite crear rutas del día manualmente: sucursal, responsable, fecha, paradas, secuencia y estado. Optimización automática queda para el futuro.

## IA
El agente puede mostrar catálogo, manejar carrito, solicitar ubicación, confirmar pedidos, consultar pedidos, reservar servicios y reaccionar a eventos. Nunca inventa precio, stock, disponibilidad o estado.
