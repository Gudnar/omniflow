# Conversational Ecommerce

## Flujo
WhatsApp → Agent → Storefront → Cart → Confirmación → validación servidor → Order/Appointment → evento → Agent → proceso restante.

## CommerceSession
Contexto comercial: tenant_id, contact_id, conversation_id, store_id, branch_id, cart_id, appointment_id, metadata, timestamps.

## Cart
Operaciones: create, get, add, update, remove, coupon, validate, checkout. Puede ser creado por IA o storefront.

## Confirmación
Validar tenant, branch, productos, precios, promociones, stock, dirección si delivery, fulfillment y crear Order transaccionalmente; reservar stock y emitir evento.

## Reserva
Servicio → disponibilidad → slot → datos → ubicación si aplica → Appointment → evento.

## Location
Fuente WhatsApp, browser/storefront o ambas. Pedir consentimiento/explicar motivo.

## Manual
Operador puede confirmar, cancelar, cambiar estado, preparar, marcar listo, asignar ruta y gestionar reserva.

## Abandono
cart.abandoned puede activar workflow de recuperación.

## WhatsApp
Respetar ventanas, plantillas y políticas del canal.
