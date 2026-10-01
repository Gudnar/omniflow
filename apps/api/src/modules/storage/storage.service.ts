import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve as resolvePath } from 'path';

// No S3 bucket/credentials exist in this environment (see .env.example —
// the S3_* vars are commented out as "future phases"). Rather than write
// an S3 client that could never be exercised here, images are written to
// local disk behind this single-method service — the "prepared interface"
// CLAUDE.md asks for: swapping to a real S3-compatible client later only
// touches this file, not the controller or the frontend.
export const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// Downloadable attachments on the Página de Enlaces ("Descarga nuestro
// catálogo") — a superset of the image types plus PDF, the two formats a
// small business realistically hands out as a catalog.
export const ALLOWED_DOWNLOAD_MIME_TYPES: Record<string, string> = {
  ...ALLOWED_IMAGE_MIME_TYPES,
  'application/pdf': 'pdf',
};

export const MAX_DOWNLOAD_SIZE_BYTES = 15 * 1024 * 1024;

// Phase 26: Voice/audio transcription — WhatsApp voice notes arrive as
// audio/ogg (opus codec); the others are included for completeness since
// Meta's Media API reports whatever mime_type the sender's client used.
export const ALLOWED_AUDIO_MIME_TYPES: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/amr': 'amr',
};

const UPLOADS_ROOT = join(process.cwd(), 'uploads');

function publicBaseUrl(): string {
  return process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT || 3000}`;
}

@Injectable()
export class StorageService {
  private async writeBuffer(
    tenantId: string,
    namespace: string,
    extension: string,
    buffer: Buffer,
  ): Promise<{ url: string }> {
    // Tenant-scoped path — one tenant can never guess or overwrite
    // another tenant's uploaded file. `namespace` just groups uploads by
    // feature (ecommerce branding, tenant logo, inbound audio, ...) within that.
    const dir = join(UPLOADS_ROOT, namespace, tenantId);
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}.${extension}`;
    await writeFile(join(dir, filename), buffer);

    return { url: `${publicBaseUrl()}/uploads/${namespace}/${tenantId}/${filename}` };
  }

  async saveImage(
    tenantId: string,
    file: Express.Multer.File | undefined,
    namespace: string = 'ecommerce',
  ): Promise<{ url: string }> {
    if (!file) throw new ValidationError('No file was uploaded');

    const extension = ALLOWED_IMAGE_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw new ValidationError('Unsupported image type. Use PNG, JPEG, WEBP or GIF.');
    }

    return this.writeBuffer(tenantId, namespace, extension, file.buffer);
  }

  // Called from MetaWebhookService with a buffer already downloaded from the
  // channel's Media API — no Multer file/HTTP upload involved, so no size
  // limit is enforced here the way saveImage's controller-level interceptor
  // does; WhatsApp voice notes are capped by Meta itself (16MB).
  async saveAudioBuffer(tenantId: string, buffer: Buffer, mimeType: string, namespace = 'audio'): Promise<{ url: string; mimeType: string }> {
    const extension = ALLOWED_AUDIO_MIME_TYPES[mimeType] ?? 'bin';
    const result = await this.writeBuffer(tenantId, namespace, extension, buffer);
    return { ...result, mimeType };
  }

  async saveDownloadFile(
    tenantId: string,
    file: Express.Multer.File | undefined,
    namespace: string = 'link-page',
  ): Promise<{ url: string }> {
    if (!file) throw new ValidationError('No file was uploaded');

    const extension = ALLOWED_DOWNLOAD_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw new ValidationError('Unsupported file type. Use PDF, PNG, JPEG, WEBP or GIF.');
    }

    return this.writeBuffer(tenantId, namespace, extension, file.buffer);
  }

  // Maps a previously-returned public /uploads/... URL back to the absolute
  // path on disk, for endpoints that need to stream the file back (e.g. a
  // forced download with Content-Disposition: attachment, which
  // express.static — used for normal inline serving — never sets). Returns
  // null for anything that isn't one of our own uploads (an operator could
  // have typed an arbitrary external URL into a link item), and resolves
  // the path first to reject any `..` segment smuggled into a malformed URL,
  // even though every filename we ever write is our own random UUID.
  resolveUploadedFilePath(url: string): string | null {
    const marker = '/uploads/';
    const index = url.indexOf(marker);
    if (index === -1) return null;

    const relative = url.slice(index + marker.length).split(/[?#]/)[0];
    const resolved = resolvePath(UPLOADS_ROOT, relative);
    if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + '/')) return null;

    return resolved;
  }
}
