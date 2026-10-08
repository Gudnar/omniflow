// Punto de extensión preparado para cuando se elija un proveedor externo de
// delivery real (Uber Direct, DiDi, etc. — ARCHITECTURE.md "Delivery
// futuro"). Deliberadamente SIN ninguna implementación: no hay credenciales,
// no hay llamada HTTP, no hay fila en base que lo use (DeliveryProviderType
// hoy solo tiene OWN_FLEET/TELEGRAM_NOTIFY). Construir un adapter real para
// un proveedor sin elegir es la dependencia especulativa que CLAUDE.md pide
// evitar — esta interfaz es lo que CLAUDE.md pide en cambio: una interfaz
// preparada, lista para implementarse el día que haya un proveedor concreto.

export interface DeliveryCoverageQuery {
  branchId: string;
  latitude: number;
  longitude: number;
}

export interface DeliveryQuote {
  feeAmount: number;
  currency: string;
  etaMinutes?: number;
}

export interface CreateDeliveryInput {
  branchId: string;
  pickupAddress: string;
  dropoffAddress: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  reference: string; // ej. el orderNumber — nunca el id interno de Order/Cart
}

export interface DeliveryTrackingInfo {
  status: string;
  etaMinutes?: number;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
}

export interface DeliveryProviderAdapter {
  quote(input: CreateDeliveryInput): Promise<DeliveryQuote>;
  checkCoverage(input: DeliveryCoverageQuery): Promise<boolean>;
  createDelivery(input: CreateDeliveryInput): Promise<{ externalDeliveryId: string }>;
  assign(externalDeliveryId: string): Promise<void>;
  updateStatus(externalDeliveryId: string, status: string): Promise<void>;
  cancel(externalDeliveryId: string): Promise<void>;
  track(externalDeliveryId: string): Promise<DeliveryTrackingInfo>;
}
