import { ConfirmationImagesService } from './confirmation-images.service';

describe('ConfirmationImagesService', () => {
  let service: ConfirmationImagesService;
  let storageService: any;
  let messagesService: any;

  const baseInput = {
    tenantId: 't1',
    conversationId: 'conv1',
    sendQrCode: true,
    sendReceiptImage: true,
    qrText: 'Cita confirmada\nN°: a1',
    receipt: {
      businessName: 'Demo Co',
      title: 'Cita confirmada',
      subtitle: '5 ene 2026, 09:00',
      lines: [{ label: 'Corte (60 min)', value: 'BOB 50.00' }],
      totalLabel: 'Total',
      totalValue: 'BOB 50.00',
      footer: '¡Te esperamos!',
    },
  };

  beforeEach(() => {
    storageService = { savePngBuffer: jest.fn().mockResolvedValue({ url: 'http://api/uploads/confirmations/t1/x.png' }) };
    messagesService = { create: jest.fn().mockResolvedValue({ id: 'm1' }) };
    service = new ConfirmationImagesService(storageService, messagesService);
  });

  it('sends both the QR and the receipt image as separate OUTBOUND attachments when both are enabled', async () => {
    await service.send(baseInput as any);

    expect(storageService.savePngBuffer).toHaveBeenCalledTimes(2);
    expect(messagesService.create).toHaveBeenCalledTimes(2);
    expect(messagesService.create).toHaveBeenNthCalledWith(
      1,
      'conv1',
      undefined,
      expect.objectContaining({ direction: 'OUTBOUND', attachmentMimeType: 'image/png', attachmentFileName: 'qr.png' }),
    );
    expect(messagesService.create).toHaveBeenNthCalledWith(
      2,
      'conv1',
      undefined,
      expect.objectContaining({ direction: 'OUTBOUND', attachmentMimeType: 'image/png', attachmentFileName: 'recibo.png' }),
    );
  });

  it('only sends the QR when the receipt image is disabled', async () => {
    await service.send({ ...baseInput, sendReceiptImage: false } as any);

    expect(messagesService.create).toHaveBeenCalledTimes(1);
    expect(messagesService.create).toHaveBeenCalledWith('conv1', undefined, expect.objectContaining({ attachmentFileName: 'qr.png' }));
  });

  it('only sends the receipt image when the QR is disabled', async () => {
    await service.send({ ...baseInput, sendQrCode: false } as any);

    expect(messagesService.create).toHaveBeenCalledTimes(1);
    expect(messagesService.create).toHaveBeenCalledWith('conv1', undefined, expect.objectContaining({ attachmentFileName: 'recibo.png' }));
  });

  it('sends nothing when both are disabled', async () => {
    await service.send({ ...baseInput, sendQrCode: false, sendReceiptImage: false } as any);

    expect(messagesService.create).not.toHaveBeenCalled();
    expect(storageService.savePngBuffer).not.toHaveBeenCalled();
  });

  it('does not throw when sending one image fails — logs and continues', async () => {
    messagesService.create.mockRejectedValueOnce(new Error('channel down')).mockResolvedValueOnce({ id: 'm2' });

    await expect(service.send(baseInput as any)).resolves.toBeUndefined();
    expect(messagesService.create).toHaveBeenCalledTimes(2);
  });
});
