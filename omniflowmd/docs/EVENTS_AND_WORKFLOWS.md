# Events and Workflows

## Commerce
commerce.session.created, cart.created, cart.updated, cart.abandoned, checkout.started, order.created, order.confirmed, order.paid, order.cancelled, order.ready, order.delivered.

## Booking
appointment.created, appointment.confirmed, appointment.cancelled, appointment.completed, appointment.no_show.

## Delivery futuro
delivery.created, delivery.assigned, delivery.picked_up, delivery.in_route, delivery.arriving, delivery.delivered, delivery.failed, delivery.cancelled, route.created, route.started, route.completed.

## Workflow
Trigger → Wait → Condition → Action.

Triggers: contacto, mensaje, tag, score, producto visto, carrito, order, appointment, delivery, fecha/hora.

Actions: mensajes/templates, agent, score, note, status, tags, assign human, cart/order/appointment, webhook, notify, wait.

## Ejemplo
order.confirmed → workflow → notificar operador → si delivery, esperar ruta → WhatsApp → delivery.in_route → tracking → delivery.delivered → feedback.

## Idempotencia
Actions externas deben tener keys determinísticas cuando sea posible. Retries con backoff+jitter y DLQ.
