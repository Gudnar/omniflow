export type ContactType = 'LEAD' | 'PROSPECT' | 'CUSTOMER';
export type ContactStatus = 'ACTIVE' | 'INACTIVE';
export type ContactSource =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'TIKTOK'
  | 'MESSENGER'
  | 'WEBSITE'
  | 'REFERRAL'
  | 'MANUAL';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE';
  taxId: string | null;
  description: string | null;
  logo: string | null;
  timezone: string;
  language: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  decimalSeparator: string;
  thousandsSeparator: string;
  orderApprovalMode: string;
  appointmentApprovalMode: string;
  notifyOnOrderPendingApproval: boolean;
  notifyOnAppointmentPendingApproval: boolean;
  sendAppointmentQrCode: boolean;
  sendAppointmentReceiptImage: boolean;
  sendOrderQrCode: boolean;
  sendOrderReceiptImage: boolean;
}

export type PaymentMethodType = 'CASH' | 'BANK_TRANSFER' | 'QR';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  enabled: boolean;
  sortOrder: number;
  instructions: string | null;
  qrImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AiProviderType = 'OPENAI' | 'ANTHROPIC' | 'GEMINI';
export type AiModelStatus = 'ACTIVE' | 'INACTIVE';
export type AiAgentStatus = 'ACTIVE' | 'INACTIVE';

export interface AiProvider {
  id: string;
  type: AiProviderType;
  label: string;
  connected: boolean;
}

export interface AiModel {
  id: string;
  providerId: string;
  name: string;
  label: string;
  capabilities: string[];
  status: AiModelStatus;
  provider: AiProvider;
}

export type KnowledgeDocumentStatus = 'ACTIVE' | 'INACTIVE';

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  status: KnowledgeDocumentStatus;
  createdAt: string;
  updatedAt: string;
  _count: { chunks: number };
}

export interface AiAgent {
  id: string;
  name: string;
  status: AiAgentStatus;
  modelId: string;
  model: AiModel;
  temperature: number;
  goal: string | null;
  personality: string | null;
  language: string;
  channels: BackendChannel[];
  escalationKeywords: string[];
  maxTokens: number;
  knowledgeDocuments: { document: { id: string; title: string; status: KnowledgeDocumentStatus } }[];
  enabledTools: string[];
  createdAt: string;
  updatedAt: string;
}

export type AiToolRiskLevel = 'read' | 'write' | 'critical';

export interface AiTool {
  name: string;
  description: string;
  riskLevel: AiToolRiskLevel;
}

export interface AiUsageEntry {
  id: string;
  agentId: string;
  agent: { id: string; name: string };
  conversationId: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  createdAt: string;
}

export interface AiUsageSummary {
  totals: { totalCalls: number; promptTokens: number; completionTokens: number; totalTokens: number };
  recent: AiUsageEntry[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface Company {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: ContactType;
  status: ContactStatus;
  source: ContactSource | null;
  companyId: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string } | null;
  tags: { tagId: string; tag: Tag }[];
}

export interface Note {
  id: string;
  contactId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'TASK' | 'OTHER';

export interface Activity {
  id: string;
  contactId: string;
  ownerId: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
}

export type BackendChannel = 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'MESSENGER' | 'WEBCHAT';
export type ConversationStatus = 'OPEN' | 'PENDING' | 'CLOSED';

export interface Conversation {
  id: string;
  contactId: string;
  contactChannelId: string | null;
  channel: BackendChannel;
  status: ConversationStatus;
  branchId: string | null;
  assignedToId: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  contact: { id: string; name: string };
  branch: { id: string; name: string } | null;
  contactChannel?: { id: string; externalId: string } | null;
}

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageType = 'TEXT' | 'NOTE' | 'SYSTEM' | 'TEMPLATE' | 'AUDIO' | 'CTA' | 'INTERACTIVE';

export type InteractivePayload =
  | { kind: 'quick_replies'; message: string; options: { id: string; label: string }[] }
  | { kind: 'form'; message: string; fields: { id: string; label: string; fieldType: 'text' | 'email' | 'tel' | 'number' }[]; submitLabel: string };

export interface Attachment {
  id: string;
  url: string;
  mimeType: string;
  fileName: string;
  size: number;
}

export interface FacebookComment {
  id: string;
  postId: string;
  externalId: string | null;
  parentId: string | null;
  direction: MessageDirection;
  authorExternalId: string | null;
  authorName: string | null;
  message: string;
  createdAt: string;
}

export interface FacebookPost {
  id: string;
  externalId: string;
  message: string | null;
  permalink: string | null;
  comments: FacebookComment[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  externalId: string | null;
  senderId: string | null;
  createdAt: string;
  attachments: Attachment[];
  // Set only when type is 'CTA' — an agent-initiated "go to the store/
  // booking" message with a real, already-generated link (never a raw LLM
  // URL). See AiReplyService's send_storefront_link tool.
  ctaPayload?: { action: 'STORE' | 'BOOKING'; url: string; label: string } | null;
  // Set only when type is 'INTERACTIVE' — quick-reply buttons or an inline
  // form, sent by the AI agent or a human operator.
  interactivePayload?: InteractivePayload | null;
}

// GET /conversation-window/:token — never includes NOTE/SYSTEM messages
// (filtered server-side) or any tenant/contact identifiers.
export interface ConversationWindowData {
  businessName: string;
  businessLogo: string | null;
  messages: Message[];
}

export type EcommerceStoreStatus = 'DRAFT' | 'PUBLISHED';
export type EcommerceOperationMode = 'DIRECT_SALE' | 'BOOKING' | 'BOTH';
export type EcommerceLocationSource = 'WHATSAPP' | 'STOREFRONT' | 'BOTH' | 'NONE';
export type FulfillmentType = 'PICKUP' | 'LOCAL_DELIVERY' | 'SHIPPING';
export type EcommerceSectionType = 'BANNER' | 'TEXT_BLOCK' | 'IMAGE_GALLERY';

export interface EcommerceStoreSettings {
  logo: string | null;
  mobileLogo: string | null;
  favicon: string | null;
  heroImage: string | null;
  mobileHeroImage: string | null;
  primaryColor: string;
  secondaryColor: string;
  buttonColor: string;
  textColor: string;
  backgroundColor: string;
  promoColor: string;
  fontFamily: string;
}

export interface EcommerceSection {
  id: string;
  type: EcommerceSectionType;
  title: string | null;
  subtitle: string | null;
  config: Record<string, unknown>;
  sortOrder: number;
  enabled: boolean;
}

export interface EcommerceStore {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: EcommerceStoreStatus;
  operationMode: EcommerceOperationMode;
  locationSource: EcommerceLocationSource;
  fulfillmentOptions: FulfillmentType[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  settings: EcommerceStoreSettings;
  sections: EcommerceSection[];
  branchIds: string[];
  chatEnabled: boolean;
  // Count of linked branches carrying both latitude/longitude — the
  // storefront only ever prompts for geolocation when this is >= 2 (nothing
  // meaningful to choose between otherwise).
  locatableBranchCount: number;
  // Only present on the public /storefront/:slug response (Phase: Storefront público).
  whatsappPhone?: string | null;
}

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type BranchProductStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type InventoryMovementType = 'RESTOCK' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type InventoryTransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string | null;
  sku: string;
  attributes: Record<string, unknown>;
  sortOrder: number;
}

export interface ProductMedia {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Product {
  id: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  requiresPreparation: boolean;
  preparationReason: string | null;
  preparationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
  variants: ProductVariant[];
  media: ProductMedia[];
}

export interface BranchProduct {
  id: string;
  branchId: string;
  productId: string;
  variantId: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  reservedStock: number;
  minStock: number | null;
  maxStock: number | null;
  reorderPoint: number | null;
  status: BranchProductStatus;
  branch: { id: string; name: string };
  variant: { id: string; name: string | null; sku: string };
}

export interface InventoryMovement {
  id: string;
  branchProductId: string;
  type: InventoryMovementType;
  quantityChange: number;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface InventoryTransferItem {
  id: string;
  transferId: string;
  variantId: string;
  quantity: number;
  variant: { id: string; name: string | null; sku: string };
}

export interface InventoryTransfer {
  id: string;
  fromBranchId: string;
  toBranchId: string;
  status: InventoryTransferStatus;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  fromBranch: { id: string; name: string };
  toBranch: { id: string; name: string };
  items: InventoryTransferItem[];
}

export interface CustomerAddress {
  id: string;
  contactId: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  reference: string | null;
  city: string | null;
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CartStatus = 'ACTIVE' | 'CHECKED_OUT' | 'ABANDONED' | 'CANCELLED';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  product: { id: string; name: string; requiresPreparation: boolean; preparationReason: string | null; preparationMinutes: number | null };
  variant: { id: string; name: string | null; sku: string };
}

export interface Cart {
  id: string;
  contactId: string;
  commerceSessionId: string;
  branchId: string | null;
  status: CartStatus;
  currency: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: CartItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  requiresPreparationSnapshot: boolean;
  preparationReasonSnapshot: string | null;
  preparationMinutesSnapshot: number | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface Order {
  id: string;
  contactId: string;
  cartId: string;
  branchId: string | null;
  addressId: string | null;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  confirmedAt: string | null;
  createdAt: string;
  trackingCode: string | null;
  customerLocation: { latitude: number; longitude: number; address?: string } | null;
  items: OrderItem[];
  address: CustomerAddress | null;
  contact: { id: string; name: string };
  branch: { id: string; name: string } | null;
  fulfillment: Fulfillment | null;
}

// Phase 18: Manual fulfillment
export type FulfillmentStatus = 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface Fulfillment {
  id: string;
  orderId: string | null;
  type: FulfillmentType;
  status: FulfillmentStatus;
  branchId: string | null;
  addressId: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  receivedByName: string | null;
  note: string | null;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  changedByUserId: string | null;
  createdAt: string;
}

export type BookingServiceStatus = 'ACTIVE' | 'INACTIVE';
export type BookingResourceType = 'STAFF' | 'ROOM' | 'EQUIPMENT' | 'OTHER';
export type BookingResourceStatus = 'ACTIVE' | 'INACTIVE';
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface BookingService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  status: BookingServiceStatus;
  qualifiedUsers: { serviceId: string; userId: string }[];
}

export interface BookingResourceSchedule {
  id: string;
  resourceId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface BookingResource {
  id: string;
  branchId: string;
  name: string;
  type: BookingResourceType;
  userId: string | null;
  status: BookingResourceStatus;
  branch: { id: string; name: string };
  services: { serviceId: string; service: { id: string; name: string } }[];
  schedule: BookingResourceSchedule[];
}

export interface UserScheduleInterval {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface UserSchedule {
  id: string;
  userId: string;
  name: string;
  timezone: string;
  intervals: UserScheduleInterval[];
}

export interface UserTimeOff {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  resourceIds: string[];
}

export interface BookingBlackoutDate {
  id: string;
  branchId: string;
  date: string;
  reason: string | null;
}

export interface AppointmentServiceEntry {
  id: string;
  appointmentId: string;
  serviceId: string;
  serviceNameSnapshot: string;
  priceSnapshot: number;
  durationMinutesSnapshot: number;
}

export interface AppointmentResourceEntry {
  appointmentId: string;
  resourceId: string;
  resource: { id: string; name: string; type: BookingResourceType };
}

export interface Appointment {
  id: string;
  contactId: string;
  branchId: string;
  addressId: string | null;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes: string | null;
  patientName: string | null;
  groupId: string | null;
  subtotal: number;
  total: number;
  currency: string;
  confirmedAt: string | null;
  createdAt: string;
  contact: { id: string; name: string };
  branch: { id: string; name: string; timezone: string };
  address: CustomerAddress | null;
  services: AppointmentServiceEntry[];
  resources: AppointmentResourceEntry[];
}

export interface AppointmentStatusHistoryEntry {
  id: string;
  appointmentId: string;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  note: string | null;
  changedByUserId: string | null;
  createdAt: string;
}

// Phase 16: Workflows

export type FlowStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type FlowNodeType = 'TRIGGER' | 'CONDITION' | 'ACTION' | 'WAIT' | 'END';
export type FlowExecutionStatus = 'RUNNING' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type FlowExecutionLogStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface FlowNode {
  id: string;
  flowId: string;
  type: FlowNodeType;
  subtype: string;
  name: string | null;
  config: Record<string, any>;
  positionX: number;
  positionY: number;
}

export interface FlowEdge {
  id: string;
  flowId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: 'true' | 'false' | null;
}

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  status: FlowStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowExecutionLogEntry {
  id: string;
  executionId: string;
  nodeId: string;
  status: FlowExecutionLogStatus;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface FlowExecution {
  id: string;
  flowId: string;
  status: FlowExecutionStatus;
  triggerEventType: string | null;
  contextData: Record<string, any>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  logs?: FlowExecutionLogEntry[];
}

// Phase 17: Campañas/Plantillas

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DISABLED';

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  headerText: string | null;
  bodyText: string;
  footerText: string | null;
  status: TemplateStatus;
  externalTemplateId: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentFilter {
  status?: 'ACTIVE' | 'INACTIVE';
  type?: 'LEAD' | 'PROSPECT' | 'CUSTOMER';
  tagIds?: string[];
  purchasedProductId?: string;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  filterQuery: SegmentFilter;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface VariableMappingEntry {
  source: 'contact_field' | 'static';
  value: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  templateId: string;
  template: { id: string; name: string; status: TemplateStatus };
  segmentId: string;
  segment: { id: string; name: string };
  variableMapping: Record<string, VariableMappingEntry>;
  status: CampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  recipientCounts?: { PENDING: number; SENT: number; FAILED: number };
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

// Storefront público (link enviado al cliente por WhatsApp)

export interface StorefrontProduct {
  id: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    categoryId: string | null;
    category?: { id: string; name: string } | null;
    media: { id: string; url: string }[];
  };
  variant: { id: string; name: string | null; sku: string };
}

export interface StorefrontProductVariant {
  id: string;
  name: string | null;
  sku: string;
  price: number | null;
  stock: number;
  available: boolean;
}

export interface StorefrontProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: { id: string; name: string } | null;
  variants: StorefrontProductVariant[];
  media: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
}

export interface StorefrontSession {
  id: string;
  contactId: string;
  branchId: string | null;
  cart: Cart | null;
  // Set only when this session's conversation was reached via /chat/[token]
  // (the web continuation window) — the success screen should return there
  // instead of opening a generic wa.me link.
  returnConversationUrl: string | null;
  branch: { id: string; name: string } | null;
}

export interface StorefrontPurchase {
  kind: 'order' | 'appointment';
  id: string;
  date: string;
  label: string;
  status: string;
  total: number;
  currency: string;
}

export interface StorefrontBookingService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  status: BookingServiceStatus;
}

export type LinkPageStatus = 'DRAFT' | 'PUBLISHED';

export interface LinkPageItem {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  sortOrder: number;
  enabled: boolean;
  clickCount: number;
}

export interface LinkPage {
  id: string;
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  status: LinkPageStatus;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  chatEnabled: boolean;
  items: LinkPageItem[];
}

// Only what the public page needs — no tenantId/clickCount, mirrors exactly
// what GET /link-page/public/:slug returns.
export interface PublicLinkPage {
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  chatEnabled: boolean;
  items: { id: string; label: string; url: string; icon: string | null }[];
}

export interface WebchatMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: string;
  createdAt: string;
  ctaPayload?: { action: 'STORE' | 'BOOKING'; url: string; label: string } | null;
  interactivePayload?: InteractivePayload | null;
  attachments?: Attachment[];
}

// GET /analytics/overview — backs the dashboard home page. `changePct` is
// null (not 0) when there's no prior-week data to compare against, so the
// UI can say "sin datos previos" instead of a misleading "+0%"/"-100%".
export interface AnalyticsTrend {
  value: number;
  changePct: number | null;
  sparkline: number[];
}

export interface AnalyticsOverview {
  stats: {
    newLeads: AnalyticsTrend;
    conversations: AnalyticsTrend;
    orders: AnalyticsTrend;
    revenue: AnalyticsTrend;
    appointments: AnalyticsTrend;
  };
  channelBreakdown: { channel: BackendChannel; count: number }[];
  orderFunnel: { status: OrderStatus; count: number }[];
  upcomingAppointments: { id: string; contactName: string; serviceName: string | null; startAt: string; status: AppointmentStatus }[];
  recentLeads: { id: string; name: string; phone: string | null; createdAt: string }[];
  salesByBranch: { branchId: string; branchName: string; total: number }[];
  recentActivity: { id: string; type: string; subject: string; description: string | null; contactName: string; occurredAt: string }[];
}
