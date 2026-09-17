import type {
  Account,
  Address,
  Basket,
  BrewfittTeamMember,
  Case,
  Category,
  ChangeRequest,
  Configuration,
  ConfiguratorRules,
  Contact,
  Delivery,
  Document,
  Invoice,
  Job,
  KnowledgeItem,
  Message,
  Notification,
  Offer,
  Payment,
  PaymentRun,
  PriceList,
  PriceListLine,
  Product,
  PurchaseOrder,
  Quote,
  Rfq,
  SalesOrder,
  StockPosition,
  SupplierProduct,
  SupplierQuote,
  Thread,
} from "@/types";
import { daysBetween, isoDate, shiftDates, today } from "./clock";
import { applyMutation, type Change, type MutationEntry } from "./mutations";
import { generateDb } from "./seed";
import { DB_VERSION } from "./version";

export { DB_VERSION };

/** The whole mock TOTA360v5 dataset. */
export type MockDb = {
  version: number;
  /** YYYY-MM-DD the data was generated for. */
  asOf: string;
  team: BrewfittTeamMember[];
  accounts: Account[];
  contacts: Contact[];
  addresses: Address[];
  categories: Category[];
  products: Product[];
  priceLists: PriceList[];
  priceListLines: PriceListLine[];
  stock: StockPosition[];
  /** Month (1–12) → seasonal demand factor. */
  seasonality: Record<number, number>;
  configuratorRules: ConfiguratorRules;
  configurations: Configuration[];
  baskets: Basket[];
  quotes: Quote[];
  rfqs: Rfq[];
  supplierQuotes: SupplierQuote[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  deliveries: Delivery[];
  changeRequests: ChangeRequest[];
  invoices: Invoice[];
  payments: Payment[];
  paymentRuns: PaymentRun[];
  jobs: Job[];
  cases: Case[];
  knowledge: KnowledgeItem[];
  documents: Document[];
  supplierProducts: SupplierProduct[];
  offers: Offer[];
  threads: Thread[];
  messages: Message[];
  notifications: Notification[];
  /** Insights the account has dismissed. */
  dismissedInsightIds: string[];
};

/**
 * Persistence (decision 2). The seed is regenerated for today on every load
 * (about 50 ms), and the changes testers make are kept as a log of mutations
 * that is replayed on top, with its dates moved forward by the days since it
 * was recorded. The log stays small, so browser storage limits are never an
 * issue and "Reset demo data" simply clears it.
 */
const LOG_KEY = `brewfitt-demo-log-v${DB_VERSION}`;

let cache: MockDb | null = null;
let log: MutationEntry[] = [];

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readLog(): MutationEntry[] {
  try {
    const store = storage();
    // Logs from earlier seed versions can never replay; drop them.
    for (const key of Object.keys(store ?? {})) {
      if (key.startsWith("brewfitt-demo-log-v") && key !== LOG_KEY) store?.removeItem(key);
    }
    const raw = store?.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as MutationEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLog() {
  try {
    storage()?.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // Storage blocked or full: changes last for this session only.
  }
}

function build(): MockDb {
  const now = today();
  const db = generateDb(now);
  log = readLog();
  const replayed: MutationEntry[] = [];
  for (const entry of log) {
    const shifted = shiftDates(entry.changes, Math.max(0, daysBetween(entry.asOf, now)));
    try {
      applyMutation(db, { ...entry, changes: shifted });
      replayed.push(entry);
    } catch {
      // A change that no longer applies (for example after a seed update) is dropped.
    }
  }
  if (replayed.length !== log.length) {
    log = replayed;
    writeLog();
  }
  return db;
}

export function getDb(): MockDb {
  if (!cache) cache = build();
  return cache;
}

/** Apply a user action's changes and record them so they survive reloads. */
export function commit(op: string, changes: Change[]): MockDb {
  const db = getDb();
  const entry: MutationEntry = { op, asOf: isoDate(today()), changes };
  applyMutation(db, entry);
  log.push(entry);
  writeLog();
  return db;
}

/** "Reset demo data" in the user menu. */
export function resetDb(): void {
  log = [];
  try {
    storage()?.removeItem(LOG_KEY);
  } catch {
    // Ignore; the in-memory reset still applies.
  }
  cache = null;
}

/** Rebuild from the seed and the stored log, as a page reload does. */
export function reloadDb(): void {
  cache = null;
}

/** Small realistic latency so loading states are exercised. */
export function latency(min = 160, max = 480): Promise<void> {
  // Scripts (check:api) run without simulated latency.
  if (typeof process !== "undefined" && process.env.MOCK_LATENCY === "0") return Promise.resolve();
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let idSeq = 0;
/** Ids for records created at runtime; unique across sessions. */
export function newId(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}${idSeq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Next human-readable number in a series, e.g. SO-104790. */
export function nextNumber(prefix: string, existing: { number: string }[]): string {
  const max = existing.reduce((m, r) => {
    const n = r.number.startsWith(prefix) ? Number(r.number.slice(prefix.length)) : 0;
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${max + 1}`;
}
