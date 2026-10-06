import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { ValidationError } from '@omniflow/utils';
import { ProductStatus, BranchProductStatus } from '@omniflow/database';

const SHEET_NAME = 'Productos';

const STATUS_LABEL: Record<ProductStatus, string> = { DRAFT: 'Borrador', ACTIVE: 'Activo', ARCHIVED: 'Archivado' };
const STATUS_CODE: Record<string, ProductStatus> = { Borrador: 'DRAFT', Activo: 'ACTIVE', Archivado: 'ARCHIVED' };

const BRANCH_STATUS_LABEL: Record<BranchProductStatus, string> = { AVAILABLE: 'Disponible', UNAVAILABLE: 'No disponible' };
const BRANCH_STATUS_CODE: Record<string, BranchProductStatus> = { Disponible: 'AVAILABLE', 'No disponible': 'UNAVAILABLE' };

const COLUMNS = [
  'Producto',
  'Slug',
  'Categoría',
  'Descripción',
  'Estado',
  'Variante',
  'SKU',
  'Atributos',
  'Sucursal',
  'Precio',
  'Precio comparación',
  'Stock',
  'Estado sucursal',
] as const;

// Same slugify shape as ecommerce-store.service.ts/link-page.service.ts —
// not shared, each call site's fallback word differs and the function is
// three lines, not worth a package for.
function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'categoria';
}

function formatAttributes(attributes: unknown): string {
  if (!attributes || typeof attributes !== 'object') return '';
  return Object.entries(attributes as Record<string, unknown>)
    .map(([k, v]) => `${k}=${v}`)
    .join(';');
}

function parseAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const pair of raw.split(';')) {
    const [key, value] = pair.split('=');
    if (key?.trim() && value?.trim()) attributes[key.trim()] = value.trim();
  }
  return attributes;
}

export interface ImportSummary {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  pricesUpdated: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class ProductsImportExportService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  // One row per (variant, branch) — the real granularity of price/stock in
  // this system — with a single blank-branch row for a variant that has no
  // BranchProduct yet, so the catalog structure still round-trips even
  // before any sucursal has pricing set up.
  async exportProducts(): Promise<Buffer> {
    const products = await this.prisma.client.product.findMany({
      include: {
        category: { select: { name: true } },
        variants: {
          orderBy: { sortOrder: 'asc' },
          include: { branchProducts: { include: { branch: { select: { name: true } } } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rows: Record<(typeof COLUMNS)[number], string | number>[] = [];
    for (const product of products) {
      for (const variant of product.variants) {
        const base = {
          Producto: product.name,
          Slug: product.slug,
          Categoría: product.category?.name ?? '',
          Descripción: product.description ?? '',
          Estado: STATUS_LABEL[product.status as ProductStatus],
          Variante: variant.name ?? '',
          SKU: variant.sku,
          Atributos: formatAttributes(variant.attributes),
        };
        if (variant.branchProducts.length === 0) {
          rows.push({ ...base, Sucursal: '', Precio: '', 'Precio comparación': '', Stock: '', 'Estado sucursal': '' });
        } else {
          for (const bp of variant.branchProducts) {
            rows.push({
              ...base,
              Sucursal: bp.branch.name,
              Precio: Number(bp.price),
              'Precio comparación': bp.compareAtPrice === null ? '' : Number(bp.compareAtPrice),
              Stock: bp.stock,
              'Estado sucursal': BRANCH_STATUS_LABEL[bp.status as BranchProductStatus],
            });
          }
        }
      }
    }

    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...COLUMNS] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // Upserts by Slug (product) and SKU (variant) — re-importing a
  // previously-exported file is how a tenant bulk-edits prices/stock: edit
  // the spreadsheet, re-upload, nothing gets duplicated. A row only needs
  // Producto+Slug+SKU to create/update the catalog structure; Sucursal is
  // optional, so a structure-only import (no pricing touched) also works.
  // One row's failure (bad branch name, invalid price) is recorded and
  // skipped rather than aborting the whole file — a 500-row import with one
  // typo shouldn't lose the other 499.
  async importProducts(buffer: Buffer): Promise<ImportSummary> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) throw new ValidationError('No tenant context for import');

    let rows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
      throw new ValidationError('No se pudo leer el archivo — ¿es un .xlsx válido?');
    }

    const summary: ImportSummary = {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      pricesUpdated: 0,
      errors: [],
    };

    const branches = await this.prisma.client.branch.findMany({ select: { id: true, name: true } });
    const branchByName = new Map<string, { id: string; name: string }>(branches.map((b: any) => [b.name.trim().toLowerCase(), b]));
    const categories = await this.prisma.client.category.findMany({ select: { id: true, name: true } });
    const categoryByName = new Map<string, { id: string; name: string }>(categories.map((c: any) => [c.name.trim().toLowerCase(), c]));

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const r = rows[i] as Record<string, string | number>;
      try {
        const productName = String(r['Producto'] ?? '').trim();
        const slug = String(r['Slug'] ?? '').trim();
        const sku = String(r['SKU'] ?? '').trim();
        if (!productName || !slug || !sku) {
          summary.errors.push({ row: rowNum, message: 'Faltan campos obligatorios (Producto, Slug, SKU)' });
          continue;
        }

        let categoryId: string | undefined;
        const categoryName = String(r['Categoría'] ?? '').trim();
        if (categoryName) {
          const key = categoryName.toLowerCase();
          const existingCategory = categoryByName.get(key);
          const category = existingCategory ?? (await this.prisma.client.category.create({ data: { name: categoryName, slug: slugify(categoryName) } }));
          if (!existingCategory) categoryByName.set(key, category);
          categoryId = category.id;
        }

        const statusLabel = String(r['Estado'] ?? '').trim();
        const status = STATUS_CODE[statusLabel];
        const description = String(r['Descripción'] ?? '').trim() || undefined;

        const existingProduct = await this.prisma.client.product.findUnique({ where: { tenantId_slug: { tenantId, slug } } });
        let productId: string;
        if (existingProduct) {
          await this.prisma.client.product.update({
            where: { id: existingProduct.id },
            data: { name: productName, description, categoryId, ...(status && { status }) },
          });
          productId = existingProduct.id;
          summary.productsUpdated++;
        } else {
          const created = await this.prisma.client.product.create({
            data: { name: productName, slug, description, categoryId, status: status ?? 'DRAFT' },
          });
          productId = created.id;
          summary.productsCreated++;
        }

        const variantName = String(r['Variante'] ?? '').trim() || undefined;
        const attributes = parseAttributes(String(r['Atributos'] ?? ''));

        const existingVariant = await this.prisma.client.productVariant.findUnique({ where: { tenantId_sku: { tenantId, sku } } });
        let variantId: string;
        if (existingVariant) {
          if (existingVariant.productId !== productId) {
            summary.errors.push({ row: rowNum, message: `El SKU "${sku}" ya pertenece a otro producto` });
            continue;
          }
          await this.prisma.client.productVariant.update({ where: { id: existingVariant.id }, data: { name: variantName, attributes } });
          variantId = existingVariant.id;
          summary.variantsUpdated++;
        } else {
          const created = await this.prisma.client.productVariant.create({ data: { productId, sku, name: variantName, attributes } });
          variantId = created.id;
          summary.variantsCreated++;
        }

        const branchName = String(r['Sucursal'] ?? '').trim();
        if (!branchName) continue;

        const branch = branchByName.get(branchName.toLowerCase());
        if (!branch) {
          summary.errors.push({ row: rowNum, message: `Sucursal "${branchName}" no existe` });
          continue;
        }

        const price = Number(r['Precio']);
        if (!Number.isFinite(price) || price < 0) {
          summary.errors.push({ row: rowNum, message: 'Precio inválido' });
          continue;
        }
        const compareAtPriceRaw = r['Precio comparación'];
        const compareAtPrice = compareAtPriceRaw !== '' && compareAtPriceRaw !== undefined ? Number(compareAtPriceRaw) : undefined;
        const stock = Number(r['Stock']) || 0;
        const branchStatus = BRANCH_STATUS_CODE[String(r['Estado sucursal'] ?? '').trim()] ?? 'AVAILABLE';

        await this.prisma.client.branchProduct.upsert({
          where: { branchId_variantId: { branchId: branch.id, variantId } },
          update: { price, compareAtPrice, stock, status: branchStatus },
          create: { branchId: branch.id, productId, variantId, price, compareAtPrice, stock, status: branchStatus },
        });
        summary.pricesUpdated++;
      } catch (err: any) {
        summary.errors.push({ row: rowNum, message: err.message ?? 'Error desconocido' });
      }
    }

    return summary;
  }
}
