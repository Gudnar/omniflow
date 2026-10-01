// Content-Disposition's plain `filename=` parameter is ASCII-only — an
// accented label like "Descargar catálogo" left as-is gets silently mangled
// by some browsers (truncated at the first non-ASCII byte) instead of
// properly falling back. Sanitizing to a safe ASCII name sidesteps relying
// on every client correctly supporting the `filename*=UTF-8''...` variant.
export function safeDownloadFilename(label: string, extension: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return `${base || 'archivo'}${extension}`;
}
