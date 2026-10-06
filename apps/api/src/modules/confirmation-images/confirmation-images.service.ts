import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';
import { MessagesService } from '../conversations/messages.service';
import { buildReceiptSvg, ReceiptLine } from './receipt-svg';

export interface ConfirmationImagesInput {
  tenantId: string;
  conversationId: string;
  sendQrCode: boolean;
  sendReceiptImage: boolean;
  qrText: string;
  receipt: {
    businessName: string;
    title: string;
    subtitle: string;
    lines: ReceiptLine[];
    totalLabel: string;
    totalValue: string;
    footer: string;
  };
}

// Sends the post-confirmation "ticket" images (QR + rendered receipt) into
// the conversation the booking/order came from. Shared by
// AppointmentsService.create() and CartsService.checkout() — same two
// images, same delivery mechanism (an OUTBOUND image Message, which
// MessagesService already fans out to WhatsApp/Instagram/webchat), only the
// content differs per caller. Best-effort: a failure here (e.g. sharp
// missing a system font) must never roll back or fail the appointment/order
// that already committed.
@Injectable()
export class ConfirmationImagesService {
  private readonly logger = new Logger(ConfirmationImagesService.name);

  constructor(
    private storageService: StorageService,
    private messagesService: MessagesService,
  ) {}

  async send(input: ConfirmationImagesInput): Promise<void> {
    if (input.sendQrCode) {
      await this.sendOne(input, async () => {
        const buffer = await QRCode.toBuffer(input.qrText, { width: 480, margin: 2 });
        return { buffer, content: 'Código QR de tu confirmación', fileName: 'qr.png' };
      });
    }

    if (input.sendReceiptImage) {
      await this.sendOne(input, async () => {
        const svg = buildReceiptSvg(input.receipt);
        const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
        return { buffer, content: input.receipt.title, fileName: 'recibo.png' };
      });
    }
  }

  private async sendOne(
    input: ConfirmationImagesInput,
    build: () => Promise<{ buffer: Buffer; content: string; fileName: string }>,
  ): Promise<void> {
    try {
      const { buffer, content, fileName } = await build();
      const { url } = await this.storageService.savePngBuffer(input.tenantId, buffer, 'confirmations');
      await this.messagesService.create(input.conversationId, undefined as any, {
        direction: 'OUTBOUND',
        type: 'TEXT',
        content,
        attachmentUrl: url,
        attachmentMimeType: 'image/png',
        attachmentFileName: fileName,
      } as any);
    } catch (error) {
      this.logger.error('Failed to send a confirmation image', error as Error);
    }
  }
}
