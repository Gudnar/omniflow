import { ToolDefinition } from './types';

// search_promotions/search_packs from AI_SPEC.md's "Ecommerce tools" list
// are deliberately NOT here — there is no Promotion/Pack model anywhere in
// the schema (ARCHITECTURE.md lists them as a future module, never built in
// any phase). A tool with nothing to query is worse than no tool: it would
// either fabricate results or always return empty, neither useful. Add them
// once a real promotions/packs feature exists.
export const ECOMMERCE_TOOLS: ToolDefinition[] = [
  {
    name: 'search_products',
    description: 'Busca productos activos y disponibles en el catálogo de la tienda por nombre o categoría.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar en el nombre del producto (opcional).' },
        categoryName: { type: 'string', description: 'Nombre de la categoría para filtrar (opcional).' },
      },
    },
  },
  {
    name: 'check_stock',
    description: 'Consulta el stock disponible de una variante de producto en la sucursal de esta conversación.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: { variantId: { type: 'string', description: 'Id de la variante de producto.' } },
      required: ['variantId'],
    },
  },
  {
    name: 'find_branch',
    description: 'Lista las sucursales del negocio, opcionalmente filtradas por nombre.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Texto a buscar en el nombre de la sucursal (opcional).' } },
    },
  },
  {
    name: 'get_price',
    description: 'Consulta el precio vigente de una variante de producto en la sucursal de esta conversación.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: { variantId: { type: 'string', description: 'Id de la variante de producto.' } },
      required: ['variantId'],
    },
  },
  {
    name: 'create_cart',
    description: 'Crea (o reutiliza, si ya existe) el carrito de compras de esta conversación. Normalmente no hace falta llamarla directo: add_to_cart ya crea el carrito si no existe.',
    riskLevel: 'write',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_cart',
    description: 'Muestra el contenido actual del carrito de esta conversación: productos, cantidades y total.',
    riskLevel: 'read',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'add_to_cart',
    description: 'Agrega una variante de producto al carrito de esta conversación, con la cantidad indicada.',
    riskLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        variantId: { type: 'string', description: 'Id de la variante de producto a agregar.' },
        quantity: { type: 'number', description: 'Cantidad a agregar (mínimo 1).' },
      },
      required: ['variantId', 'quantity'],
    },
  },
  {
    name: 'modify_cart',
    description: 'Cambia la cantidad de un ítem ya presente en el carrito.',
    riskLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Id del ítem del carrito (lo devuelve get_cart).' },
        quantity: { type: 'number', description: 'Nueva cantidad (mínimo 1).' },
      },
      required: ['itemId', 'quantity'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'Quita un ítem del carrito.',
    riskLevel: 'write',
    parameters: {
      type: 'object',
      properties: { itemId: { type: 'string', description: 'Id del ítem del carrito (lo devuelve get_cart).' } },
      required: ['itemId'],
    },
  },
  {
    name: 'create_checkout',
    description:
      'Finaliza la compra del carrito actual y crea el pedido real. Úsala solo cuando el cliente confirmó explícitamente que quiere pagar/finalizar, con el carrito ya armado. Según cómo esté configurado el negocio, el pedido puede confirmarse al instante o quedar pendiente de revisión — informa siempre al cliente del resultado que te devuelve esta herramienta, nunca asumas que ya está confirmado.',
    riskLevel: 'critical',
    parameters: {
      type: 'object',
      properties: {
        fulfillmentType: { type: 'string', enum: ['PICKUP', 'LOCAL_DELIVERY', 'SHIPPING'], description: 'Cómo recibirá el pedido el cliente.' },
        addressId: { type: 'string', description: 'Id de una dirección ya guardada del cliente — obligatorio si fulfillmentType no es PICKUP.' },
      },
      required: ['fulfillmentType'],
    },
  },
  // Alias of create_checkout — AI_SPEC.md lists both names; this domain only
  // has one real "finalize the purchase" action (CartsService.checkout()),
  // so both names execute the identical handler rather than offering two
  // tools that do the same thing under different labels.
  {
    name: 'create_order',
    description: 'Igual que create_checkout: finaliza la compra del carrito actual y crea el pedido real.',
    riskLevel: 'critical',
    parameters: {
      type: 'object',
      properties: {
        fulfillmentType: { type: 'string', enum: ['PICKUP', 'LOCAL_DELIVERY', 'SHIPPING'], description: 'Cómo recibirá el pedido el cliente.' },
        addressId: { type: 'string', description: 'Id de una dirección ya guardada del cliente — obligatorio si fulfillmentType no es PICKUP.' },
      },
      required: ['fulfillmentType'],
    },
  },
  {
    name: 'get_order',
    description: 'Consulta el estado y detalle de un pedido del cliente de esta conversación.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: { orderNumber: { type: 'string', description: 'Número de pedido (ej. ORD-XXXXX).' } },
      required: ['orderNumber'],
    },
  },
  {
    name: 'cancel_order',
    description: 'Cancela un pedido del cliente de esta conversación, si todavía está en un estado cancelable.',
    riskLevel: 'critical',
    parameters: {
      type: 'object',
      properties: { orderNumber: { type: 'string', description: 'Número de pedido a cancelar (ej. ORD-XXXXX).' } },
      required: ['orderNumber'],
    },
  },
  {
    name: 'request_location',
    description:
      'Úsala cuando necesites la dirección de entrega del cliente para una entrega a domicilio o envío. No obtiene la ubicación por sí misma — te recuerda pedírsela al cliente, o sugerirle el enlace de la tienda donde puede compartir su ubicación real desde el navegador.',
    riskLevel: 'read',
    parameters: { type: 'object', properties: {} },
  },
];

export const BOOKING_TOOLS: ToolDefinition[] = [
  {
    name: 'search_booking_services',
    description: 'Busca servicios de reserva/cita activos, por nombre.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Texto a buscar en el nombre del servicio (opcional).' } },
    },
  },
  {
    name: 'get_available_slots',
    description: 'Consulta los horarios disponibles de un servicio de reserva en una fecha dada.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Id del servicio de reserva.' },
        date: { type: 'string', description: 'Fecha a consultar, formato YYYY-MM-DD.' },
      },
      required: ['serviceId', 'date'],
    },
  },
  {
    name: 'find_best_specialist',
    description: 'Lista los especialistas/recursos que ofrecen un servicio y están disponibles en una fecha dada.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Id del servicio de reserva.' },
        date: { type: 'string', description: 'Fecha a consultar, formato YYYY-MM-DD (opcional).' },
      },
      required: ['serviceId'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Reserva una cita real para el cliente de esta conversación. Úsala solo cuando el cliente confirmó explícitamente el servicio, fecha y hora. Según cómo esté configurado el negocio, la cita puede confirmarse al instante o quedar pendiente de aprobación — informa siempre al cliente del resultado que te devuelve esta herramienta.',
    riskLevel: 'critical',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'Id del servicio de reserva.' },
        startAt: { type: 'string', description: 'Fecha y hora de inicio en ISO 8601 (ej. 2026-03-10T14:30:00.000Z), tal como la devolvió get_available_slots.' },
        patientName: { type: 'string', description: 'Nombre de la persona para quien es la cita, si es distinta de quien reserva (opcional).' },
      },
      required: ['serviceId', 'startAt'],
    },
  },
  {
    name: 'reschedule_appointment',
    description: 'Cambia la fecha/hora de una cita ya reservada por el cliente de esta conversación.',
    riskLevel: 'critical',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'Id de la cita a reprogramar.' },
        startAt: { type: 'string', description: 'Nueva fecha y hora de inicio en ISO 8601.' },
      },
      required: ['appointmentId', 'startAt'],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancela una cita del cliente de esta conversación, si todavía está en un estado cancelable.',
    riskLevel: 'critical',
    parameters: {
      type: 'object',
      properties: { appointmentId: { type: 'string', description: 'Id de la cita a cancelar.' } },
      required: ['appointmentId'],
    },
  },
  {
    name: 'get_appointment',
    description: 'Consulta el estado y detalle de una cita del cliente de esta conversación.',
    riskLevel: 'read',
    parameters: {
      type: 'object',
      properties: { appointmentId: { type: 'string', description: 'Id de la cita.' } },
      required: ['appointmentId'],
    },
  },
];

// Conversation UI tools — unlike the ecommerce/booking tools above, these
// don't read/write domain data: sending the interactive element to the
// customer IS the reply (same `terminal` shape as send_storefront_link,
// handled directly in AiReplyService rather than AiToolsService). Offering
// is still gated by AiAgent.enabledTools like everything else.
export const CONVERSATION_TOOLS: ToolDefinition[] = [
  {
    name: 'send_quick_replies',
    description:
      'Envía al cliente un mensaje con 2 o 3 botones de respuesta rápida para que elija uno tocándolo, en vez de escribir. Úsala cuando quieras ofrecer opciones claras y limitadas (ej. "¿Querés retiro o envío?").',
    riskLevel: 'write',
    terminal: true,
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'El mensaje/pregunta que acompaña los botones.' },
        options: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 3,
          description: 'Entre 2 y 3 opciones breves (cada una se convierte en un botón).',
        },
      },
      required: ['message', 'options'],
    },
  },
  {
    name: 'send_form',
    description:
      'Envía al cliente un formulario con campos para completar dentro del chat (ej. nombre, teléfono, email). Solo funciona en conversaciones de chat web — nunca la uses si no estás seguro de que la conversación es por chat web.',
    riskLevel: 'write',
    terminal: true,
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mensaje breve que explica para qué es el formulario.' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Etiqueta del campo, ej. "Nombre completo".' },
              fieldType: { type: 'string', enum: ['text', 'email', 'tel', 'number'] },
            },
            required: ['label', 'fieldType'],
          },
          minItems: 1,
          maxItems: 6,
        },
        submitLabel: { type: 'string', description: 'Texto del botón de enviar (opcional, por defecto "Enviar").' },
      },
      required: ['message', 'fields'],
    },
  },
  {
    name: 'send_webchat_link',
    description:
      'Envía al cliente un enlace para seguir la conversación desde el navegador (chat web), con todo el historial. Útil cuando el cliente quiere más comodidad para escribir o seguir más tarde. Nunca la uses si la conversación ya es por chat web.',
    riskLevel: 'write',
    terminal: true,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Mensaje breve y amigable (1-2 frases) que acompaña el enlace, en el idioma configurado del agente. No incluyas la URL, se agrega automáticamente.',
        },
      },
      required: ['message'],
    },
  },
];

export const ALL_TOOLS: ToolDefinition[] = [...ECOMMERCE_TOOLS, ...BOOKING_TOOLS, ...CONVERSATION_TOOLS];
export const ALL_TOOL_NAMES = ALL_TOOLS.map((t) => t.name);

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}
