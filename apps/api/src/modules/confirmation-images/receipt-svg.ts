// Builds the receipt image as SVG, rasterized to PNG by sharp (which bundles
// librsvg) in confirmation-images.service.ts — no canvas/font-rendering
// dependency of our own, just string templating.
export interface ReceiptLine {
  label: string;
  value: string;
}

export interface ReceiptContent {
  businessName: string;
  title: string;
  subtitle: string;
  lines: ReceiptLine[];
  totalLabel: string;
  totalValue: string;
  footer: string;
}

const WIDTH = 720;
const PADDING = 48;
const LINE_HEIGHT = 34;
const HEADER_HEIGHT = 190;
const FOOTER_HEIGHT = 90;

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildReceiptSvg(content: ReceiptContent): string {
  const height = HEADER_HEIGHT + content.lines.length * LINE_HEIGHT + FOOTER_HEIGHT;
  const rows = content.lines
    .map((line, i) => {
      const y = HEADER_HEIGHT + i * LINE_HEIGHT + 22;
      return `
        <text x="${PADDING}" y="${y}" font-family="sans-serif" font-size="20" fill="#374151">${esc(line.label)}</text>
        <text x="${WIDTH - PADDING}" y="${y}" font-family="sans-serif" font-size="20" font-weight="600" fill="#111827" text-anchor="end">${esc(line.value)}</text>`;
    })
    .join('');

  const dividerY = HEADER_HEIGHT + content.lines.length * LINE_HEIGHT + 12;
  const totalY = dividerY + 44;

  return `<svg width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${WIDTH}" height="${height}" fill="#f7f7f7"/>
    <rect x="16" y="16" width="${WIDTH - 32}" height="${height - 32}" rx="24" fill="#ffffff"/>
    <text x="${PADDING}" y="68" font-family="sans-serif" font-size="22" font-weight="700" fill="#111827">${esc(content.businessName)}</text>
    <text x="${PADDING}" y="104" font-family="sans-serif" font-size="26" font-weight="800" fill="#111827">${esc(content.title)}</text>
    <text x="${PADDING}" y="134" font-family="sans-serif" font-size="18" fill="#6b7280">${esc(content.subtitle)}</text>
    <line x1="${PADDING}" y1="158" x2="${WIDTH - PADDING}" y2="158" stroke="#e5e7eb" stroke-width="2"/>
    ${rows}
    <line x1="${PADDING}" y1="${dividerY}" x2="${WIDTH - PADDING}" y2="${dividerY}" stroke="#e5e7eb" stroke-width="2"/>
    <text x="${PADDING}" y="${totalY}" font-family="sans-serif" font-size="22" font-weight="800" fill="#111827">${esc(content.totalLabel)}</text>
    <text x="${WIDTH - PADDING}" y="${totalY}" font-family="sans-serif" font-size="22" font-weight="800" fill="#111827" text-anchor="end">${esc(content.totalValue)}</text>
    <text x="${WIDTH / 2}" y="${height - 36}" font-family="sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle">${esc(content.footer)}</text>
  </svg>`;
}
