import { prisma } from '@omniflow/database';
import { decryptSecret, logger } from '@omniflow/utils';

export interface DeliveryNotifyJobData {
  tenantId: string;
  stopId?: string;
  orderId?: string;
}

interface NotifyContext {
  branchId: string | null;
  headerText: string;
  orderNumber: string;
  contactName: string;
  address: { addressLine: string; latitude: number | null; longitude: number | null } | null;
}

// Fase 20: notificar una entrega por Telegram — solo fetch + llamada a la
// Bot API, sin lógica de dominio propia (mismo patrón directo-a-Postgres de
// whatsapp-outbound-processor.ts, no el callback-a-la-API que usan
// ai/transcription por su orquestación más pesada).
//
// Dos formas de job sobre la misma cola:
// - stopId: ruta planificada (Fase 19) — se avisa al agregar la parada.
// - orderId: entrega individual sin ruta (sucursal en modo IMMEDIATE) — se
//   avisa al confirmarse el pedido.
export async function processDeliveryNotifyJob(data: DeliveryNotifyJobData): Promise<void> {
  const ctx = data.stopId ? await loadFromStop(data.stopId) : data.orderId ? await loadFromOrder(data.orderId) : null;
  if (!ctx || !ctx.branchId) return;

  const config =
    (await prisma.deliveryProviderConfig.findFirst({
      where: { tenantId: data.tenantId, branchId: ctx.branchId, enabled: true },
    })) ??
    (await prisma.deliveryProviderConfig.findFirst({
      where: { tenantId: data.tenantId, branchId: null, enabled: true },
    }));

  if (!config || config.type !== 'TELEGRAM_NOTIFY' || !config.botTokenEncrypted) return;

  const chatId = (config.config as any)?.chatId;
  if (!chatId) return;

  const botToken = decryptSecret(config.botTokenEncrypted);
  const lines = [
    ctx.headerText,
    `Pedido ${ctx.orderNumber} — ${ctx.contactName}`,
    ctx.address?.addressLine ? `Dirección: ${ctx.address.addressLine}` : null,
  ].filter(Boolean);

  const requests = [
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n') }),
    }),
  ];
  if (ctx.address?.latitude != null && ctx.address?.longitude != null) {
    requests.push(
      fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, latitude: ctx.address.latitude, longitude: ctx.address.longitude }),
      }),
    );
  }

  const results = await Promise.all(requests);
  for (const res of results) {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('[delivery-notify] Telegram API call failed', undefined, { status: res.status, text });
    }
  }
}

async function loadFromStop(stopId: string): Promise<NotifyContext | null> {
  const stop = await prisma.deliveryRouteStop.findUnique({
    where: { id: stopId },
    include: {
      route: { select: { branchId: true } },
      fulfillment: {
        include: {
          order: { select: { orderNumber: true, contact: { select: { name: true } } } },
          address: true,
        },
      },
    },
  });
  if (!stop?.fulfillment.order) return null;

  return {
    branchId: stop.route.branchId,
    headerText: '🚚 Nueva parada de entrega',
    orderNumber: stop.fulfillment.order.orderNumber,
    contactName: stop.fulfillment.order.contact.name,
    address: stop.fulfillment.address,
  };
}

async function loadFromOrder(orderId: string): Promise<NotifyContext | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, branchId: true, contact: { select: { name: true } }, address: true },
  });
  if (!order) return null;

  return {
    branchId: order.branchId,
    headerText: '🚚 Nuevo pedido para entregar',
    orderNumber: order.orderNumber,
    contactName: order.contact.name,
    address: order.address,
  };
}
