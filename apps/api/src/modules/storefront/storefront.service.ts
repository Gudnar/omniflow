import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { EcommerceStoreService } from '../ecommerce/ecommerce-store.service';
import { CommerceSessionsService } from '../commerce/commerce-sessions.service';
import { CartsService } from '../commerce/carts.service';
import { AddressesService } from '../commerce/addresses.service';
import { ContactCommerceService } from '../commerce/contact-commerce.service';
import { PaymentMethodsService } from '../payments/payment-methods.service';
import { StorageService } from '../storage/storage.service';
import { serializeBranchProduct } from '../catalog/products.service';
import { AddCartItemDto, UpdateCartItemDto, CheckoutDto } from '../commerce/dto/cart.dto';
import { SessionLocationDto } from '../commerce/dto/commerce-session.dto';
import { CreateAddressDto } from '../commerce/dto/address.dto';

/**
 * Public storefront — every method resolves a tenant from an opaque public
 * identifier (a store's slug, or a CommerceSession's magic-link token) using
 * the RAW (unscoped) prisma client, then seeds TenantContextService before
 * delegating into the same, unmodified Phase 8-11 domain services normal
 * admin routes use. This mirrors meta-webhook.service.ts's "public route
 * resolves tenant from trusted payload contents, not a JWT" pattern — see
 * storefront.controller.ts for why every route here is @Public().
 *
 * No raw CommerceSession/Cart/Order id is ever accepted from the client —
 * only the slug and the publicToken. This is the IDOR/BOLA defense
 * SECURITY.md calls out as a mandatory test category for public surfaces.
 */
@Injectable()
export class StorefrontService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private storeService: EcommerceStoreService,
    private sessionsService: CommerceSessionsService,
    private cartsService: CartsService,
    private addressesService: AddressesService,
    private contactCommerceService: ContactCommerceService,
    private paymentMethodsService: PaymentMethodsService,
    private storageService: StorageService,
  ) {}

  async resolveStoreBySlug(slug: string) {
    const store = await this.prisma.raw.ecommerceStore.findUnique({ where: { slug } });
    if (!store || store.status !== 'PUBLISHED') {
      throw new NotFoundError('Store');
    }
    this.tenantContext.setContext({ tenantId: store.tenantId });
    return store;
  }

  async getStore(slug: string) {
    const store = await this.resolveStoreBySlug(slug);
    const full = await this.storeService.getOrCreate(store.tenantId);

    // Surfaced so the "Volver a WhatsApp" click-to-chat link on the success
    // screen has a real number to open — not part of the admin-only shape
    // EcommerceStoreService normally returns.
    const connection = await this.prisma.client.metaConnection.findUnique({
      where: { tenantId_channel: { tenantId: store.tenantId, channel: 'WHATSAPP' } },
    });

    // Tells the frontend whether it's even worth prompting for geolocation
    // at all — a store with fewer than 2 branches carrying coordinates has
    // nothing for CommerceSessionsService.setNearestBranch to choose
    // between, so there's no point asking (SECURITY.md: only request
    // location when actually necessary/configured).
    const branchLinks = await this.prisma.client.ecommerceStoreBranch.findMany({
      where: { storeId: store.id },
      include: { branch: { select: { latitude: true, longitude: true } } },
    });
    const locatableBranchCount = branchLinks.filter(
      (l: any) => l.branch.latitude != null && l.branch.longitude != null,
    ).length;

    return { ...full, whatsappPhone: connection?.displayName ?? null, locatableBranchCount };
  }

  // Only the enabled methods, for the checkout screen / AI agent to show the
  // customer how to pay — never the disabled ones an operator is still
  // drafting.
  async getPaymentMethods(slug: string) {
    await this.resolveStoreBySlug(slug);
    return this.paymentMethodsService.listEnabled();
  }

  // Resolves a real filesystem path so the controller can res.download() it
  // — forces an actual browser download (Content-Disposition: attachment)
  // regardless of cross-origin, same mechanism already used for the Página
  // de Enlaces catalog download (LinkPageService.resolveDownload).
  async getQrDownload(slug: string, id: string) {
    await this.resolveStoreBySlug(slug);
    const { qrImageUrl, label } = await this.paymentMethodsService.resolveQrDownload(id);
    const filePath = this.storageService.resolveUploadedFilePath(qrImageUrl);
    if (!filePath) throw new NotFoundError('PaymentMethod');
    return { filePath, label };
  }

  private async defaultBranchId(storeId: string): Promise<string> {
    const link = await this.prisma.client.ecommerceStoreBranch.findFirst({ where: { storeId } });
    if (!link) throw new ValidationError('This store has no branches configured yet');
    return link.branchId;
  }

  // A client-supplied branchId (from the nearest-branch geolocation flow)
  // is only ever trusted after confirming it's actually linked to THIS
  // store — never blindly, same IDOR discipline as every other lookup in
  // this file. Falls back to the pre-existing "first branch" behavior when
  // absent or invalid, so single-branch stores (everything today) are
  // unaffected.
  private async resolveBranchId(storeId: string, requestedBranchId?: string): Promise<string> {
    if (requestedBranchId) {
      const valid = await this.prisma.client.ecommerceStoreBranch.findUnique({
        where: { storeId_branchId: { storeId, branchId: requestedBranchId } },
      });
      if (valid) return requestedBranchId;
    }
    return this.defaultBranchId(storeId);
  }

  async listProducts(slug: string, branchId?: string) {
    const store = await this.resolveStoreBySlug(slug);
    const resolvedBranchId = await this.resolveBranchId(store.id, branchId);

    const rows = await this.prisma.client.branchProduct.findMany({
      where: { branchId: resolvedBranchId, status: 'AVAILABLE', stock: { gt: 0 } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            categoryId: true,
            category: { select: { id: true, name: true } },
            requiresPreparation: true,
            preparationReason: true,
            preparationMinutes: true,
            media: { where: { isPrimary: true }, take: 1, select: { id: true, url: true } },
          },
        },
        variant: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeBranchProduct);
  }

  async getProduct(slug: string, productId: string, branchId?: string) {
    const store = await this.resolveStoreBySlug(slug);
    const resolvedBranchId = await this.resolveBranchId(store.id, branchId);

    const product = await this.prisma.client.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { id: true, name: true } },
        variants: { orderBy: { sortOrder: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundError('Product');

    const branchProducts = await this.prisma.client.branchProduct.findMany({
      where: { branchId: resolvedBranchId, variantId: { in: product.variants.map((v: any) => v.id) } },
    });
    const byVariant = new Map<string, any>(branchProducts.map((bp: any) => [bp.variantId, bp]));

    return {
      ...product,
      variants: product.variants.map((v: any) => {
        const bp = byVariant.get(v.id);
        return {
          ...v,
          price: bp ? Number(bp.price) : null,
          stock: bp?.stock ?? 0,
          available: bp ? bp.status === 'AVAILABLE' && bp.stock > 0 : false,
        };
      }),
    };
  }

  async resolveSessionByToken(token: string) {
    const session = await this.prisma.raw.commerceSession.findUnique({ where: { publicToken: token } });
    if (!session || !session.publicTokenExpiresAt || session.publicTokenExpiresAt < new Date()) {
      throw new ValidationError('This link has expired. Ask the business for a new one.');
    }
    this.tenantContext.setContext({ tenantId: session.tenantId });
    return session;
  }

  async getSession(token: string) {
    const session = await this.resolveSessionByToken(token);
    const result = await this.sessionsService.findOne(session.id);

    // "Volver a WhatsApp" on the success screen only makes sense for a
    // customer who actually has a real WhatsApp conversation to return to.
    // A customer who arrived via /chat/[token] (the web continuation
    // window) has no such thing — this is what they should return to
    // instead, resolved from the session's own conversation when it has one.
    let returnConversationUrl: string | null = null;
    if (result.conversationId) {
      const conversation = await this.prisma.client.conversation.findUnique({
        where: { id: result.conversationId },
        select: { webchatToken: true },
      });
      if (conversation?.webchatToken) {
        const baseUrl = process.env.STOREFRONT_BASE_URL || 'http://localhost:3000';
        returnConversationUrl = `${baseUrl}/chat/${conversation.webchatToken}`;
      }
    }

    let branch: { id: string; name: string } | null = null;
    if (result.branchId) {
      branch = await this.prisma.client.branch.findUnique({
        where: { id: result.branchId },
        select: { id: true, name: true },
      });
    }

    return { ...result, returnConversationUrl, branch };
  }

  async addItem(token: string, dto: AddCartItemDto) {
    const session = await this.resolveSessionByToken(token);
    const cart = await this.sessionsService.getOrCreateCart(session.id);
    return this.cartsService.addItem(cart.id, dto);
  }

  async updateItem(token: string, itemId: string, dto: UpdateCartItemDto) {
    const session = await this.resolveSessionByToken(token);
    const cart = await this.sessionsService.getOrCreateCart(session.id);
    return this.cartsService.updateItem(cart.id, itemId, dto);
  }

  async removeItem(token: string, itemId: string) {
    const session = await this.resolveSessionByToken(token);
    const cart = await this.sessionsService.getOrCreateCart(session.id);
    return this.cartsService.removeItem(cart.id, itemId);
  }

  async recordLocation(token: string, dto: SessionLocationDto) {
    const session = await this.resolveSessionByToken(token);
    return this.sessionsService.recordLocation(session.id, dto);
  }

  async setNearestBranch(token: string, dto: SessionLocationDto) {
    const session = await this.resolveSessionByToken(token);
    await this.sessionsService.setNearestBranch(session.id, dto);
    // Re-resolve through getSession() rather than returning
    // CommerceSessionsService's raw result directly, so the response carries
    // the same branch/returnConversationUrl enrichment the frontend already
    // expects on every other session read (one shape, one place that builds it).
    return this.getSession(token);
  }

  async createAddress(token: string, dto: CreateAddressDto) {
    const session = await this.resolveSessionByToken(token);
    return this.addressesService.create(session.contactId, dto);
  }

  async checkout(token: string, dto: CheckoutDto) {
    const session = await this.resolveSessionByToken(token);
    const cart = await this.sessionsService.getOrCreateCart(session.id);
    return this.cartsService.checkout(cart.id, dto);
  }

  // Read-only "my purchases and reservations" history — the one place a
  // customer can see everything they've bought or booked after leaving the
  // one-shot success screen. contactId always comes from the session, never
  // from the client.
  async getPurchases(token: string) {
    const session = await this.resolveSessionByToken(token);
    return this.contactCommerceService.listPurchases(session.contactId);
  }
}
