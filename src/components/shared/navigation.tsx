import {
  BookOpenIcon,
  CalculatorIcon,
  ChatsCircleIcon,
  CreditCardIcon,
  FadersHorizontalIcon,
  FileTextIcon,
  FolderIcon,
  HouseIcon,
  LifebuoyIcon,
  PackageIcon,
  ReceiptIcon,
  StorefrontIcon,
  TagIcon,
  TrendUpIcon,
  WarehouseIcon,
  WrenchIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { PersonaKind } from "@/types";

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
  mobile?: boolean;
  mobileLabel?: string;
};

/** BLUEPRINT.md "Navigation": customer desktop sidebar. */
const CUSTOMER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HouseIcon, mobile: true, mobileLabel: "Home" },
  { href: "/shop", label: "Shop", icon: StorefrontIcon, mobile: true },
  { href: "/configurator", label: "Dispense Designer", icon: FadersHorizontalIcon },
  { href: "/price-list", label: "Price list", icon: TagIcon },
  { href: "/quotes", label: "Quotes", icon: FileTextIcon },
  { href: "/orders", label: "Orders", icon: PackageIcon, mobile: true },
  { href: "/invoices", label: "Invoices", icon: ReceiptIcon },
  { href: "/stock", label: "Stock", icon: WarehouseIcon },
  { href: "/jobs", label: "Jobs", icon: WrenchIcon },
  { href: "/cases", label: "Customer Support", icon: LifebuoyIcon },
  { href: "/knowledge", label: "Knowledge", icon: BookOpenIcon },
  { href: "/documents", label: "Documents", icon: FolderIcon },
  { href: "/messages", label: "Messages", icon: ChatsCircleIcon, mobile: true },
];

/** BLUEPRINT.md "Navigation": supplier desktop sidebar. */
const SUPPLIER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HouseIcon, mobile: true, mobileLabel: "Home" },
  {
    href: "/quotes",
    label: "RFQs and quotes",
    icon: FileTextIcon,
    mobile: true,
    mobileLabel: "RFQs",
  },
  {
    href: "/orders",
    label: "Purchase orders",
    icon: PackageIcon,
    mobile: true,
    mobileLabel: "Orders",
  },
  { href: "/invoices", label: "Payments", icon: CreditCardIcon },
  { href: "/stock", label: "Stock and forecast", icon: TrendUpIcon },
  { href: "/products", label: "Products and offers", icon: TagIcon },
  { href: "/cases", label: "Supplier Support", icon: LifebuoyIcon },
  { href: "/knowledge", label: "Knowledge", icon: BookOpenIcon },
  { href: "/documents", label: "Documents", icon: FolderIcon },
  { href: "/messages", label: "Messages", icon: ChatsCircleIcon, mobile: true },
];

/** Brewfitt staff (decision 14): internal tools only; quotes are read-only. */
const STAFF_NAV: NavItem[] = [
  { href: "/internal/configurator", label: "Configurator", icon: CalculatorIcon, mobile: true },
  { href: "/internal/quotes", label: "Quotes", icon: FileTextIcon, mobile: true },
];

export function navFor(kind: PersonaKind): NavItem[] {
  return kind === "staff" ? STAFF_NAV : kind === "supplier" ? SUPPLIER_NAV : CUSTOMER_NAV;
}

/** Where the logo and redirects lead for each persona. */
export function homeFor(kind: PersonaKind): string {
  return kind === "staff" ? "/internal/configurator" : "/dashboard";
}

/** Routes outside the sidebar that customers and suppliers can reach. */
const SHARED_ROUTES = ["/account", "/notifications", "/onboarding"];

export function isRouteAllowed(kind: PersonaKind, pathname: string): boolean {
  const base = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  if (kind === "staff") return navFor(kind).some((item) => isActive(pathname, item.href));
  return SHARED_ROUTES.includes(base) || navFor(kind).some((item) => item.href === base);
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
