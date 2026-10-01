import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { CreateSessionDto, SessionLocationDto } from './dto/commerce-session.dto';
import { serializeCart, CART_INCLUDE } from './carts.service';

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class CommerceSessionsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateSessionDto) {
    const store = await this.prisma.client.ecommerceStore.findUnique({ where: { tenantId } });

    return this.prisma.client.commerceSession.create({
      data: {
        contactId: dto.contactId,
        conversationId: dto.conversationId,
        branchId: dto.branchId,
        storeId: store?.id,
        metadata: dto.metadata ?? {},
      },
    });
  }

  async findOne(id: string) {
    const session = await this.prisma.client.commerceSession.findUnique({
      where: { id },
      // A session can have accumulated more than one Cart over its lifetime
      // (Cart.commerceSessionId isn't @unique — see schema comment); only
      // the single ACTIVE one, if any, is ever "the" cart callers expect.
      include: { carts: { where: { status: 'ACTIVE' }, include: CART_INCLUDE, take: 1 } },
    });
    if (!session) throw new NotFoundError('CommerceSession');
    const { carts, ...rest } = session;
    return { ...rest, cart: carts[0] ? serializeCart(carts[0]) : null };
  }

  // Get-or-create: returns the session's existing ACTIVE cart if present,
  // else creates a new one inheriting branchId/conversationId from the
  // session — safe to call repeatedly even after a prior cart on this same
  // session was checked out (a second visit to the same storefront link
  // buying again), since Cart no longer enforces a strict 1:1 with its session.
  async getOrCreateCart(id: string) {
    const session = await this.findOne(id);
    if (session.cart) {
      return session.cart;
    }

    const cart = await this.prisma.client.$transaction(async (tx: any) => {
      const created = await tx.cart.create({
        data: {
          contactId: session.contactId,
          commerceSessionId: session.id,
          conversationId: session.conversationId,
          branchId: session.branchId,
        },
        include: CART_INCLUDE,
      });

      await tx.commerceSession.update({ where: { id: session.id }, data: { cartId: created.id } });

      return created;
    });

    return serializeCart(cart);
  }

  // Reassigns the session's branch to whichever linked branch is closest to
  // the given coordinates — but ONLY before a cart exists. Cart.branchId is
  // fixed at creation (see getOrCreateCart above) and never resynced, so
  // swapping the session's branch afterward would silently disagree with
  // stock/pricing the customer already committed to under a different
  // branch. Also a no-op when fewer than two linked branches carry both
  // latitude/longitude — nothing meaningful to choose between, and asking
  // for location at all wouldn't be "necessary/configured" (SECURITY.md).
  async setNearestBranch(id: string, dto: SessionLocationDto) {
    const session = await this.findOne(id);
    if (session.cart || !session.storeId) return session;

    const links = await this.prisma.client.ecommerceStoreBranch.findMany({
      where: { storeId: session.storeId },
      include: { branch: true },
    });
    const candidates = links
      .map((l: any) => l.branch)
      .filter((b: any) => b.latitude != null && b.longitude != null);
    if (candidates.length < 2) return session;

    const nearest = candidates.reduce((best: any, branch: any) => {
      const distance = haversineKm(dto.latitude, dto.longitude, branch.latitude, branch.longitude);
      return !best || distance < best.distance ? { branch, distance } : best;
    }, null as { branch: any; distance: number } | null)!;

    await this.prisma.client.commerceSession.update({ where: { id }, data: { branchId: nearest.branch.id } });
    return this.findOne(id);
  }

  async recordLocation(id: string, dto: SessionLocationDto) {
    const session = await this.findOne(id);
    return this.prisma.client.commerceSession.update({
      where: { id },
      data: {
        metadata: {
          ...(session.metadata as Record<string, unknown>),
          location: { latitude: dto.latitude, longitude: dto.longitude, address: dto.address },
        },
      },
    });
  }
}
