import { StorageService } from './storage.service';
import { ValidationError } from '@omniflow/utils';
import { mkdir, writeFile } from 'fs/promises';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageService();
  });

  it('rejects when no file was uploaded', async () => {
    await expect(service.saveImage('t1', undefined)).rejects.toThrow(ValidationError);
  });

  it('rejects an unsupported mimetype', async () => {
    const file = { mimetype: 'application/pdf', buffer: Buffer.from('x') } as any;
    await expect(service.saveImage('t1', file)).rejects.toThrow(ValidationError);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('writes an accepted image under a tenant-scoped path and returns its URL', async () => {
    const file = { mimetype: 'image/png', buffer: Buffer.from('fake-png') } as any;

    const result = await service.saveImage('tenant-42', file);

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('uploads/ecommerce/tenant-42'), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(expect.stringMatching(/tenant-42[/\\][0-9a-f-]+\.png$/), file.buffer);
    expect(result.url).toMatch(/^http:\/\/localhost:\d+\/uploads\/ecommerce\/tenant-42\/[0-9a-f-]+\.png$/);
  });

  it('writes under a custom namespace when one is provided', async () => {
    const file = { mimetype: 'image/png', buffer: Buffer.from('fake-png') } as any;

    const result = await service.saveImage('tenant-42', file, 'tenant');

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('uploads/tenant/tenant-42'), { recursive: true });
    expect(result.url).toMatch(/^http:\/\/localhost:\d+\/uploads\/tenant\/tenant-42\/[0-9a-f-]+\.png$/);
  });

  describe('saveDownloadFile', () => {
    it('rejects an unsupported mimetype', async () => {
      const file = { mimetype: 'application/zip', buffer: Buffer.from('x') } as any;
      await expect(service.saveDownloadFile('t1', file)).rejects.toThrow(ValidationError);
    });

    it('accepts a PDF under the default "link-page" namespace', async () => {
      const file = { mimetype: 'application/pdf', buffer: Buffer.from('%PDF') } as any;
      const result = await service.saveDownloadFile('tenant-42', file);

      expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('uploads/link-page/tenant-42'), { recursive: true });
      expect(result.url).toMatch(/^http:\/\/localhost:\d+\/uploads\/link-page\/tenant-42\/[0-9a-f-]+\.pdf$/);
    });
  });

  describe('resolveUploadedFilePath', () => {
    it('returns null for a URL that is not one of our own uploads', () => {
      expect(service.resolveUploadedFilePath('https://example.com/somewhere/file.pdf')).toBeNull();
    });

    it('resolves a real upload URL to its absolute path on disk', () => {
      const path = service.resolveUploadedFilePath('http://localhost:3001/uploads/link-page/t1/abc.pdf');
      expect(path).toMatch(/uploads[/\\]link-page[/\\]t1[/\\]abc\.pdf$/);
    });

    it('rejects a path-traversal attempt smuggled into the URL', () => {
      expect(service.resolveUploadedFilePath('http://localhost:3001/uploads/../../etc/passwd')).toBeNull();
    });
  });

  describe('saveAudioBuffer', () => {
    it('writes an audio/ogg buffer under the default "audio" namespace with a .ogg extension', async () => {
      const result = await service.saveAudioBuffer('tenant-42', Buffer.from('fake-audio'), 'audio/ogg');

      expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('uploads/audio/tenant-42'), { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(expect.stringMatching(/tenant-42[/\\][0-9a-f-]+\.ogg$/), Buffer.from('fake-audio'));
      expect(result.url).toMatch(/^http:\/\/localhost:\d+\/uploads\/audio\/tenant-42\/[0-9a-f-]+\.ogg$/);
      expect(result.mimeType).toBe('audio/ogg');
    });

    it('falls back to a .bin extension for an unrecognized mime type', async () => {
      const result = await service.saveAudioBuffer('tenant-42', Buffer.from('x'), 'audio/weird');
      expect(result.url).toMatch(/\.bin$/);
    });
  });
});
