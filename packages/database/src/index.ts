import { PrismaClient } from './prisma';

let prismaInstance: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prismaInstance = new PrismaClient();
} else {
  const globalForPrisma = global as unknown as { prisma: PrismaClient };
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: ['info', 'warn', 'error'],
    });
  }
  prismaInstance = globalForPrisma.prisma;
}

export const prisma = prismaInstance;

export * from './tenant-scope';
export type { Prisma } from './prisma';
export { BranchStatus, ContactType, ContactStatus, ContactSource, ActivityType } from './prisma';
export { Channel, ConversationStatus, MessageDirection, MessageType } from './prisma';
export { MetaConnectionStatus, TikTokConnectionStatus } from './prisma';
export {
  EcommerceStoreStatus,
  EcommerceOperationMode,
  EcommerceLocationSource,
  FulfillmentType,
  EcommerceSectionType,
} from './prisma';
export {
  CategoryStatus,
  ProductStatus,
  BranchProductStatus,
  InventoryMovementType,
  InventoryTransferStatus,
} from './prisma';
export { CartStatus, OrderStatus } from './prisma';
export {
  BookingServiceStatus,
  BookingResourceType,
  BookingResourceStatus,
  UserScheduleStatus,
  AppointmentStatus,
} from './prisma';
export {
  FlowStatus,
  FlowNodeType,
  FlowExecutionStatus,
  FlowExecutionLogStatus,
} from './prisma';
export {
  TemplateCategory,
  TemplateStatus,
  CampaignStatus,
  CampaignRecipientStatus,
} from './prisma';
export { FulfillmentStatus } from './prisma';
export { AiProviderType, AiModelStatus, AiAgentStatus } from './prisma';
export { KnowledgeDocumentStatus } from './prisma';
export { LinkPageStatus } from './prisma';
