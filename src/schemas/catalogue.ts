import { z } from "zod";
import { Currency, Id, IsoDate, IsoDateTime, Money } from "./common";

/** Brewfitt's trade range sections on brewfitt.com. */
export const CatalogueSection = z.enum(["cellar", "bar", "mobile-dispense"]);

export const Category = z.object({
  id: Id,
  name: z.string().min(1),
  section: CatalogueSection,
  parentId: Id.nullable(),
  description: z.string().min(1),
  image: z.string().nullable(),
});

export const Unit = z.enum(["each", "pack", "metre", "roll", "cylinder", "litre", "kit", "set"]);

export const Product = z.object({
  id: Id,
  sku: z.string().min(1),
  name: z.string().min(1),
  /** Category id. */
  category: Id,
  /** Sub-category id, when the category has children. */
  subcategory: Id.nullable(),
  description: z.string().min(1),
  /** Paths under /products/. */
  images: z.array(z.string()),
  /** Null: spec sheet not yet available (none exist in OMv4). */
  specSheetDocumentId: Id.nullable(),
  unit: Unit,
  packSize: z.int().positive(),
  listPrice: Money,
  supplierId: Id,
  leadTimeDays: z.int().nonnegative(),
  active: z.boolean(),
});

export const PriceList = z.object({
  id: Id,
  name: z.string().min(1),
  currency: Currency,
  /** Customer sell list or supplier agreed cost list. */
  kind: z.enum(["sell", "cost"]),
  validFrom: IsoDate,
  validTo: IsoDate.nullable(),
});

export const PriceListLine = z.object({
  priceListId: Id,
  productId: Id,
  price: Money,
  discountPercent: z.number().min(0).max(100),
});

export const StockStatus = z.enum(["in-stock", "low", "out", "on-order"]);

export const StockPosition = z.object({
  productId: Id,
  onHand: z.int().nonnegative(),
  allocated: z.int().nonnegative(),
  available: z.int(),
  onOrder: z.int().nonnegative(),
  expectedAt: IsoDate.nullable(),
  minimumLevel: z.int().nonnegative(),
  status: StockStatus,
});

export const StockForecastMonth = z.object({
  /** YYYY-MM */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  quantity: z.int().nonnegative(),
  value: Money,
});

/** Supplier forecast = average monthly purchases over 6 months × seasonal factor. */
export const StockForecast = z.object({
  productId: Id,
  averageMonthlyQuantity: z.number().nonnegative(),
  months: z.array(StockForecastMonth),
});

/**
 * GET /api/supplier-performance (defined by the mock; not yet in TOTA360v5).
 * Purchases by month and product, and an anonymised rank by Brewfitt spend
 * among suppliers of the same kind (manufacturers or distributors).
 */
/** Share of deliveries that arrived on or before the promised date. Null when nothing was delivered. */
export const OnTimeDelivery = z.object({
  percent: z.number().min(0).max(100).nullable(),
  onTime: z.int().nonnegative(),
  total: z.int().nonnegative(),
});

/** GET /api/account/stats (customers; contract defined by the mock). Values ex VAT, last 12 months. */
export const CustomerStats = z.object({
  onTimeDelivery: OnTimeDelivery,
  orderValue: Money,
  orderCount: z.int().nonnegative(),
  averageOrderValue: Money.nullable(),
  quoteConversion: z.object({
    percent: z.number().min(0).max(100).nullable(),
    accepted: z.int().nonnegative(),
    decided: z.int().nonnegative(),
  }),
});

export const SupplierPerformance = z.object({
  monthly: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      total: Money,
      orders: z.int().nonnegative(),
      /** Average purchase order value that month; null with no orders. */
      average: Money.nullable(),
    }),
  ),
  onTimeDelivery: OnTimeDelivery,
  averageOrderValue: Money.nullable(),
  /** Customer after-sales cases (faults, warranty, returns, questions) on products this supplier supplies. */
  afterSalesIssues: z.object({
    total: z.int().nonnegative(),
    open: z.int().nonnegative(),
    last12Months: z.int().nonnegative(),
  }),
  topProducts: z.array(z.object({ productId: Id, quantity: z.int().nonnegative(), total: Money })),
  last12Months: Money,
  sector: z.enum(["manufacturer", "distributor"]),
  rank: z.int().positive(),
  supplierCount: z.int().positive(),
});

export const ProductListQuery = z.object({
  search: z.string().optional(),
  category: Id.optional(),
  section: CatalogueSection.optional(),
});

/** GET /api/price-list: the account's list joined for display. */
export const PriceListResponse = z.object({
  priceList: PriceList,
  lines: z.array(
    PriceListLine.extend({
      product: Product,
      stock: StockPosition.nullable(),
    }),
  ),
});

export const PriceListExport = z.object({
  filename: z.string().min(1),
  mimeType: z.literal("text/csv"),
  content: z.string(),
  generatedAt: IsoDateTime,
});
