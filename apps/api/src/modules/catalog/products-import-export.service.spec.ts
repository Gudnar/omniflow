import * as XLSX from 'xlsx';
import { ProductsImportExportService } from './products-import-export.service';

function buildXlsxBuffer(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Productos');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('ProductsImportExportService', () => {
  let service: ProductsImportExportService;
  let prisma: any;
  let tenantContext: any;

  beforeEach(() => {
    prisma = {
      client: {
        product: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
        productVariant: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
        branch: { findMany: jest.fn().mockResolvedValue([]) },
        category: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
        branchProduct: { upsert: jest.fn() },
      },
    };
    tenantContext = { getTenantId: jest.fn().mockReturnValue('t1') };
    service = new ProductsImportExportService(prisma, tenantContext);
  });

  describe('exportProducts', () => {
    it('produces one row per variant when it has no branch pricing yet', async () => {
      prisma.client.product.findMany.mockResolvedValue([
        {
          name: 'Pizza',
          slug: 'pizza',
          description: null,
          status: 'ACTIVE',
          category: null,
          variants: [{ name: null, sku: 'PIZZA-1', attributes: {}, branchProducts: [] }],
        },
      ]);

      const buffer = await service.exportProducts();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      expect(rows).toHaveLength(1);
      expect(rows[0].Producto).toBe('Pizza');
      expect(rows[0].SKU).toBe('PIZZA-1');
      expect(rows[0].Estado).toBe('Activo');
      expect(rows[0].Sucursal ?? '').toBe('');
    });

    it('produces one row per (variant, branch) and formats attributes as key=value pairs', async () => {
      prisma.client.product.findMany.mockResolvedValue([
        {
          name: 'Camiseta',
          slug: 'camiseta',
          description: 'Algodón',
          status: 'DRAFT',
          category: { name: 'Ropa' },
          variants: [
            {
              name: 'Roja M',
              sku: 'CAM-ROJA-M',
              attributes: { talla: 'M', color: 'Rojo' },
              branchProducts: [
                { price: '50.00', compareAtPrice: '60.00', stock: 10, status: 'AVAILABLE', branch: { name: 'Centro' } },
              ],
            },
          ],
        },
      ]);

      const buffer = await service.exportProducts();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        Producto: 'Camiseta',
        Categoría: 'Ropa',
        Estado: 'Borrador',
        Variante: 'Roja M',
        Atributos: 'talla=M;color=Rojo',
        Sucursal: 'Centro',
        Precio: 50,
        'Precio comparación': 60,
        Stock: 10,
        'Estado sucursal': 'Disponible',
      });
    });
  });

  describe('importProducts', () => {
    it('creates a new product and variant when the slug/sku do not exist yet', async () => {
      prisma.client.product.findUnique.mockResolvedValue(null);
      prisma.client.product.create.mockResolvedValue({ id: 'p1' });
      prisma.client.productVariant.findUnique.mockResolvedValue(null);
      prisma.client.productVariant.create.mockResolvedValue({ id: 'v1' });

      const buffer = buildXlsxBuffer([
        { Producto: 'Pizza', Slug: 'pizza', Categoría: '', Descripción: '', Estado: 'Activo', Variante: '', SKU: 'PIZZA-1', Atributos: '', Sucursal: '', Precio: '', 'Precio comparación': '', Stock: '', 'Estado sucursal': '' },
      ]);

      const summary = await service.importProducts(buffer);

      expect(prisma.client.product.create).toHaveBeenCalledWith({
        data: { name: 'Pizza', slug: 'pizza', description: undefined, categoryId: undefined, status: 'ACTIVE' },
      });
      expect(prisma.client.productVariant.create).toHaveBeenCalledWith({
        data: { productId: 'p1', sku: 'PIZZA-1', name: undefined, attributes: {} },
      });
      expect(summary).toEqual({ productsCreated: 1, productsUpdated: 0, variantsCreated: 1, variantsUpdated: 0, pricesUpdated: 0, errors: [] });
    });

    it('updates an existing product/variant by slug/sku instead of creating duplicates', async () => {
      prisma.client.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.client.productVariant.findUnique.mockResolvedValue({ id: 'v1', productId: 'p1' });

      const buffer = buildXlsxBuffer([
        { Producto: 'Pizza XL', Slug: 'pizza', Categoría: '', Descripción: '', Estado: '', Variante: '', SKU: 'PIZZA-1', Atributos: '', Sucursal: '', Precio: '', 'Precio comparación': '', Stock: '', 'Estado sucursal': '' },
      ]);

      const summary = await service.importProducts(buffer);

      expect(prisma.client.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { name: 'Pizza XL', description: undefined, categoryId: undefined } });
      expect(prisma.client.product.create).not.toHaveBeenCalled();
      expect(summary.productsUpdated).toBe(1);
      expect(summary.variantsUpdated).toBe(1);
    });

    it('auto-creates a missing category by name', async () => {
      prisma.client.product.findUnique.mockResolvedValue(null);
      prisma.client.product.create.mockResolvedValue({ id: 'p1' });
      prisma.client.productVariant.findUnique.mockResolvedValue(null);
      prisma.client.productVariant.create.mockResolvedValue({ id: 'v1' });
      prisma.client.category.create.mockResolvedValue({ id: 'c1', name: 'Bebidas' });

      const buffer = buildXlsxBuffer([
        { Producto: 'Cola', Slug: 'cola', Categoría: 'Bebidas', Descripción: '', Estado: '', Variante: '', SKU: 'COLA-1', Atributos: '', Sucursal: '', Precio: '', 'Precio comparación': '', Stock: '', 'Estado sucursal': '' },
      ]);

      await service.importProducts(buffer);

      expect(prisma.client.category.create).toHaveBeenCalledWith({ data: { name: 'Bebidas', slug: 'bebidas' } });
      expect(prisma.client.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ categoryId: 'c1' }) }));
    });

    it('upserts the BranchProduct when a branch and price are given', async () => {
      prisma.client.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.client.productVariant.findUnique.mockResolvedValue({ id: 'v1', productId: 'p1' });
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1', name: 'Centro' }]);

      const buffer = buildXlsxBuffer([
        { Producto: 'Pizza', Slug: 'pizza', Categoría: '', Descripción: '', Estado: '', Variante: '', SKU: 'PIZZA-1', Atributos: '', Sucursal: 'Centro', Precio: 45, 'Precio comparación': '', Stock: 20, 'Estado sucursal': 'Disponible' },
      ]);

      const summary = await service.importProducts(buffer);

      expect(prisma.client.branchProduct.upsert).toHaveBeenCalledWith({
        where: { branchId_variantId: { branchId: 'b1', variantId: 'v1' } },
        update: { price: 45, compareAtPrice: undefined, stock: 20, status: 'AVAILABLE' },
        create: { branchId: 'b1', productId: 'p1', variantId: 'v1', price: 45, compareAtPrice: undefined, stock: 20, status: 'AVAILABLE' },
      });
      expect(summary.pricesUpdated).toBe(1);
      expect(summary.errors).toEqual([]);
    });

    it('records a row error (without aborting the rest of the import) when required fields are missing', async () => {
      prisma.client.product.findUnique.mockResolvedValue(null);
      prisma.client.product.create.mockResolvedValue({ id: 'p1' });
      prisma.client.productVariant.findUnique.mockResolvedValue(null);
      prisma.client.productVariant.create.mockResolvedValue({ id: 'v1' });

      const buffer = buildXlsxBuffer([
        { Producto: '', Slug: '', Categoría: '', Descripción: '', Estado: '', Variante: '', SKU: '', Atributos: '', Sucursal: '', Precio: '', 'Precio comparación': '', Stock: '', 'Estado sucursal': '' },
        { Producto: 'Pizza', Slug: 'pizza', Categoría: '', Descripción: '', Estado: '', Variante: '', SKU: 'PIZZA-1', Atributos: '', Sucursal: '', Precio: '', 'Precio comparación': '', Stock: '', 'Estado sucursal': '' },
      ]);

      const summary = await service.importProducts(buffer);

      expect(summary.errors).toEqual([{ row: 2, message: 'Faltan campos obligatorios (Producto, Slug, SKU)' }]);
      expect(summary.productsCreated).toBe(1);
    });

    it('records a row error when the branch name does not exist, without touching stock/price', async () => {
      prisma.client.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.client.productVariant.findUnique.mockResolvedValue({ id: 'v1', productId: 'p1' });
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1', name: 'Centro' }]);

      const buffer = buildXlsxBuffer([
        { Producto: 'Pizza', Slug: 'pizza', Categoría: '', Descripción: '', Estado: '', Variante: '', SKU: 'PIZZA-1', Atributos: '', Sucursal: 'Sucursal Fantasma', Precio: 45, 'Precio comparación': '', Stock: 20, 'Estado sucursal': '' },
      ]);

      const summary = await service.importProducts(buffer);

      expect(summary.errors).toEqual([{ row: 2, message: 'Sucursal "Sucursal Fantasma" no existe' }]);
      expect(prisma.client.branchProduct.upsert).not.toHaveBeenCalled();
    });

    it('records a row error when the price is not a valid non-negative number', async () => {
      prisma.client.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.client.productVariant.findUnique.mockResolvedValue({ id: 'v1', productId: 'p1' });
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1', name: 'Centro' }]);

      const buffer = buildXlsxBuffer([
        { Producto: 'Pizza', Slug: 'pizza', Categoría: '', Descripción: '', Estado: '', Variante: '', SKU: 'PIZZA-1', Atributos: '', Sucursal: 'Centro', Precio: 'gratis', 'Precio comparación': '', Stock: 20, 'Estado sucursal': '' },
      ]);

      const summary = await service.importProducts(buffer);

      expect(summary.errors).toEqual([{ row: 2, message: 'Precio inválido' }]);
      expect(prisma.client.branchProduct.upsert).not.toHaveBeenCalled();
    });

    it('rejects a SKU that already belongs to a different product, protecting against cross-product SKU collisions', async () => {
      prisma.client.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.client.productVariant.findUnique.mockResolvedValue({ id: 'v1', productId: 'OTHER_PRODUCT' });

      const buffer = buildXlsxBuffer([
        { Producto: 'Pizza', Slug: 'pizza', Categoría: '', Descripción: '', Estado: '', Variante: '', SKU: 'TAKEN-SKU', Atributos: '', Sucursal: '', Precio: '', 'Precio comparación': '', Stock: '', 'Estado sucursal': '' },
      ]);

      const summary = await service.importProducts(buffer);

      expect(summary.errors).toEqual([{ row: 2, message: 'El SKU "TAKEN-SKU" ya pertenece a otro producto' }]);
      expect(prisma.client.productVariant.update).not.toHaveBeenCalled();
    });
  });
});
