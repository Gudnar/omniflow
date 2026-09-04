# Domain Rules

- Ecommerce configura la experiencia; Orders gestiona operaciones.
- Cart es intención mutable; Order es transacción confirmada.
- Appointment es reserva confirmada.
- Fulfillment: PICKUP, LOCAL_DELIVERY, SHIPPING.
- Branch define catálogo, stock, precio y contexto operativo.
- Cambiar branch exige revalidar carrito.
- Dirección/ubicación es dato estructurado reutilizable, asociado al contacto y referenciado por la operación.
- Delivery manual es una herramienta operativa, no un motor logístico autónomo.
- Nunca introducir dependencias específicas de un proveedor de delivery dentro de Cart/Order.
