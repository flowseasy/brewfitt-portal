import type { Category, Product } from "@/types";
import raw from "../data/brewfitt-catalogue.json";

/**
 * Brewfitt's real trade catalogue (brewfitt.com, captured for Phase 1) mapped
 * onto the Product and Category models. Prices the website does not show are
 * estimated from comparable models so the demo can price every item; they are
 * mock prices, not Brewfitt's.
 */

type RawCategory = {
  name: string;
  section: Category["section"];
  parent: string | null;
  description: string;
};
type RawProduct = {
  slug: string;
  name: string;
  siteSku: string | null;
  section: Category["section"];
  category: string;
  subcategory: string | null;
  description: string;
  images: string[];
  sitePriceGbp: number | null;
};

const catalogue = raw as { categories: RawCategory[]; products: RawProduct[] };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** The website's "Special Offers" bucket holds fonts; the portal files them as fonts. */
const RECATEGORISE: Record<string, { category: string; subcategory: string | null }> = {
  "Special Offers": { category: "Fonts", subcategory: "Beer Fonts" },
};

export function categoryId(section: string, name: string, parent: string | null): string {
  return `cat_${section}-${parent ? `${slugify(parent)}-` : ""}${slugify(name)}`;
}

export const productId = (slug: string) => `prd_${slug}`;

/** Invented suppliers by category (see seed/people.ts). */
const SUPPLIER_BY_CATEGORY: [RegExp, string][] = [
  [/^Lindr/, "sup_tapmobile"],
  [/Lindr Ice Bank|DryWet/, "sup_tapmobile"],
  [/Keg Coolers|Welbilt|Energy Saviour/, "sup_glacier"],
  [/Bottle Coolers|Wine Cooler/, "sup_chillcase"],
  [/Regulators|Gas Chain/, "sup_northgas"],
  [/Nitro Dispense/, "sup_emerald"],
  [/Line Cleaning|Cleaning|Coolants|Foam Stop/, "sup_clearflow"],
  [/CoolTube|Python/, "sup_polarflex"],
  [/Drip Tray|Glass Freshener|Badge Holders|Bar Lighting|LED Board/, "sup_brightbar"],
  [/Keg Couplers/, "sup_couplingworks"],
  [/Water Dispense|Post Mix|Hot Drinks/, "sup_aquapure"],
  [/Fonts|Taps|Tap |Clamp Assemblies/, "sup_vireo"],
];

/** Estimated list prices (GBP ex VAT) for items the website does not price. */
const ESTIMATES: [RegExp, number][] = [
  [/Gamko Keg cooler .*FK\/MU/, 1890],
  [/Gamko Keg cooler .*130 litre/, 1150],
  [/Gamko Keg cooler .*210 litre/, 1340],
  [/Gamko Keg cooler .*290 litre/, 1560],
  [/Gamko Keg cooler .*590 litre/, 2380],
  [/Gamko Keg cooler .*850 litre/, 2890],
  [/Gamko Keg cooler .*1200 litre/, 3590],
  [/Gamko Keg cooler .*1550 litre/, 4180],
  [/Gamko Keg cooler .*1840 litre/, 4760],
  [/Gamko MG3\/150/, 760],
  [/Gamko MG3\/250/, 960],
  [/Gamko MG3\/275/, 1020],
  [/Gamko MG3\/315/, 1160],
  [/AS-40 Glycol/, 690],
  [/AS-40/, 615],
  [/AS-80 2x/, 775],
  [/AS-80 4x/, 840],
  [/AS-110 INOX Tropical 2x/, 1175],
  [/AS-110 INOX Tropical 3x/, 1235],
  [/AS-110 INOX Tropical 4x/, 1260],
  [/AS-110 INOX Tropical 6x/, 1340],
  [/AS-110-us/, 1150],
  [/AS-110 2x/, 915],
  [/AS-110 4x/, 985],
  [/AS-110 6x/, 1060],
  [/AS-160 INOX Tropical 4x Tap/, 1520],
  [/AS-160 INOX Tropical 4x/, 1480],
  [/AS-160 INOX Tropical 6x/, 1560],
  [/AS-160 INOX Tropical 8x/, 1640],
  [/AS-200-us/, 1990],
  [/AS-200 2x/, 1590],
  [/AS-200 4x/, 1680],
  [/AS-200 6x/, 1760],
  [/AS-200 8x/, 1850],
  [/CWP 100/, 1080],
  [/CWP 200 4x/, 1290],
  [/CWP 200 6x/, 1380],
  [/CWP 300\/K/, 1690],
  [/CWP 300 4x/, 1450],
  [/CWP 300 6x/, 1540],
  [/CWP 300 8x/, 1630],
  [/Kontakt 40K Profi/, 890],
  [/Angram T Bar/, 420],
  [/Bridge Tower/, 560],
  [/Cobra Plus Medium/, 390],
  [/Easy Small/, 180],
  [/Event Tower 3 Out/, 345],
  [/Flag Tower/, 520],
  [/Giada 100/, 240],
  [/Modulite Tower/, 610],
  [/Tubular Tower 1 Out/, 95],
  [/Vision V15/, 676.59],
  [/Nitro Infuzer/, 1290],
];

/** Python looms are not on the website; realistic variants share the mini python loom image (decision 6). */
const PYTHON_LOOMS: RawProduct[] = [
  { lines: 2, coolant: 2, price: 11.5 },
  { lines: 4, coolant: 2, price: 16.9 },
  { lines: 6, coolant: 2, price: 22.4 },
  { lines: 8, coolant: 2, price: 28.75 },
  { lines: 12, coolant: 2, price: 39.6 },
].map(({ lines, coolant, price }) => ({
  slug: `python-loom-${lines}-line`,
  name: `${lines} Line Python Loom (per metre)`,
  siteSku: null,
  section: "cellar" as const,
  category: "Beer Coolers",
  subcategory: "Accessories",
  description: `Insulated python loom carrying ${lines} product lines and ${coolant} recirculating coolant lines from the cellar cooler to the bar. Sold per metre and cut to the length of the run.`,
  images: ["/products/2-line-mini-python-loom-secondary-cooling-2-5mtr.png"],
  sitePriceGbp: price,
}));

function unitAndPack(name: string): { unit: Product["unit"]; packSize: number } {
  if (/per metre/i.test(name)) return { unit: "metre", packSize: 1 };
  const pack = name.match(/\((?:pack|bag) of (\d+)\)|\((\d+) sachets\)|\((\d+) cylinders\)/i);
  if (pack) return { unit: "pack", packSize: Number(pack[1] ?? pack[2] ?? pack[3]) };
  if (/kit\b/i.test(name)) return { unit: "kit", packSize: 1 };
  return { unit: "each", packSize: 1 };
}

function leadTime(category: string, subcategory: string | null): number {
  const key = `${category} ${subcategory ?? ""}`;
  if (/Keg Coolers|Bottle Coolers|Wine Cooler/.test(key)) return 21;
  if (/Lindr|Welbilt|Water Dispense|Hot Drinks|Nitro/.test(key)) return 14;
  if (/Fonts|CoolTube|Recessed/.test(key)) return 10;
  return 3;
}

/** Stable 5-digit SKU for items without a usable website SKU. */
function fallbackSku(slug: string): string {
  let h = 2166136261;
  for (const c of slug) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `BF-${String(((h >>> 0) % 90000) + 10000)}`;
}

export function seedCatalogue() {
  const categories: Category[] = [];
  const seen = new Set<string>();
  for (const c of catalogue.categories) {
    if (RECATEGORISE[c.name]) continue;
    const id = categoryId(c.section, c.name, c.parent);
    if (seen.has(id)) continue;
    seen.add(id);
    categories.push({
      id,
      name: c.name,
      section: c.section,
      parentId: c.parent ? categoryId(c.section, c.parent, null) : null,
      description: c.description,
      image: null,
    });
  }

  const products: Product[] = [];
  const skus = new Set<string>();
  const slugs = new Set<string>();
  for (const source of [...catalogue.products, ...PYTHON_LOOMS]) {
    // The website reuses one slug for two Gamko variants; disambiguate with the SKU.
    const p = slugs.has(source.slug)
      ? { ...source, slug: `${source.slug}-${slugify(source.siteSku ?? String(slugs.size))}` }
      : source;
    slugs.add(p.slug);
    const re = RECATEGORISE[p.category];
    const category = re?.category ?? p.category;
    const subcategory = re ? re.subcategory : p.subcategory;
    const catId = categoryId(p.section, category, null);
    const subId = subcategory ? categoryId(p.section, subcategory, category) : null;
    if (!seen.has(catId) || (subId && !seen.has(subId))) {
      throw new Error(`Unknown category for ${p.slug}: ${category} > ${subcategory}`);
    }

    const pounds = p.sitePriceGbp ?? ESTIMATES.find(([re_]) => re_.test(p.name))?.[1];
    if (pounds == null) throw new Error(`No price or estimate for ${p.name}`);

    let sku = p.siteSku && !/\s|PARENT/i.test(p.siteSku) ? p.siteSku : fallbackSku(p.slug);
    if (skus.has(sku)) sku = fallbackSku(p.slug);
    skus.add(sku);

    // Match on category; the mixed "Accessories" category also needs the product name.
    const supplierKey = `${category} ${subcategory ?? ""}${subcategory === "Accessories" ? ` ${p.name}` : ""}`;
    const supplierId = SUPPLIER_BY_CATEGORY.find(([re_]) => re_.test(supplierKey))?.[1];
    if (!supplierId) throw new Error(`No supplier mapping for ${p.name} (${supplierKey})`);

    products.push({
      id: productId(p.slug),
      sku,
      name: p.name.replace(/\s{2,}/g, " ").trim(),
      category: catId,
      subcategory: subId,
      description: p.description,
      images: p.images,
      specSheetDocumentId: null,
      ...unitAndPack(p.name),
      listPrice: { amount: Math.round(pounds * 100), currency: "GBP" },
      supplierId,
      leadTimeDays: leadTime(category, subcategory),
      active: true,
    });
  }

  // Categories with children show a representative image from their products.
  for (const c of categories) {
    c.image =
      products.find((p) => p.category === c.id || p.subcategory === c.id)?.images[0] ?? null;
  }

  return { categories, products };
}

/** Commercial role of a product, used by the seed to shape buying patterns. */
export type ProductRole = "consumable" | "spare" | "project";

export function productRole(product: Product, categories: Category[]): ProductRole {
  const names = categories
    .filter((c) => c.id === product.category || c.id === product.subcategory)
    .map((c) => c.name)
    .join(" ");
  if (
    /Coolants|Cleaning Powder/.test(names) ||
    /Nitrogen Bottle Pack|Spring for Glass Freshener|Sticky Pads|O Ring Repair/.test(product.name)
  ) {
    return "consumable";
  }
  if (
    /Taps|Tap Handles|Tap Spares|Tap Spouts|Keg Couplers|Cleaning Sockets|Cleaning Bottles|Badge Holders|Drip Tray Accessories|Regulators|Foam Stop|Gas Chain|Clamp Assemblies|Lindr Accessories|LED Board|Bar Lighting Transformer/.test(
      names,
    ) ||
    product.unit === "metre"
  ) {
    return "spare";
  }
  return "project";
}
