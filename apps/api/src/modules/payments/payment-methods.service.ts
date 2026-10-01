import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.paymentMethod.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  // Only enabled methods, for the public storefront / conversational
  // checkout to show the customer — never exposes disabled/draft ones.
  // Relies on the caller (StorefrontService) having already resolved the
  // tenant context from the slug/session token.
  async listEnabled() {
    return this.prisma.client.paymentMethod.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const method = await this.prisma.client.paymentMethod.findUnique({ where: { id } });
    if (!method) throw new NotFoundError('PaymentMethod');
    return method;
  }

  // For the public storefront's "descargar QR para pagar" button — only a
  // method the customer can actually see (enabled, type QR, with an image
  // actually uploaded) resolves; everything else is treated as not found,
  // same as any other public lookup in this codebase.
  async resolveQrDownload(id: string) {
    const method = await this.findOne(id);
    if (method.type !== 'QR' || !method.enabled || !method.qrImageUrl) {
      throw new NotFoundError('PaymentMethod');
    }
    return { qrImageUrl: method.qrImageUrl, label: method.label };
  }

  async create(dto: CreatePaymentMethodDto) {
    return this.prisma.client.paymentMethod.create({ data: dto });
  }

  async update(id: string, dto: UpdatePaymentMethodDto) {
    await this.findOne(id);
    return this.prisma.client.paymentMethod.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.paymentMethod.delete({ where: { id } });
    return { success: true };
  }
}
