# Brewfitt Portal — Claude Code guide

The source of truth is `BLUEPRINT.md` (Phase 1 Blueprint, 16 September 2026). Read it before any substantial work. If BLUEPRINT.md is ambiguous or contradicts itself, ask the user before choosing. Do not add features it does not ask for without checking.

## What this is

A self-service customer and supplier portal for Brewfitt Limited (Huddersfield drink-dispense supplier), part of TOTA360v5 (Flowseasy's Zoho Catalyst ERP). Phase 1 is **frontend only**: the full portal UI against a mock API, realistic mock data and deterministic mock AI, so Brewfitt can test and sign it off before it is wired to TOTA360v5.

## Phase 1 boundary — do NOT build

- Production backend, database or Catalyst functions
- Authentication or authorisation (a mock persona switcher replaces login)
- Payments or card processing (mock card step only)
- Real pricing, VAT or stock calculations
- Real AI or ML (deterministic rules only, every output labelled "Simulated insight")
- Real document storage
- Real email mirroring or WhatsApp integration (channel indicator on mock messages only)
- Production sync with TOTA360v5, Zoho CRM or Zoho Books
- Internal Brewfitt staff views: team workload, pipeline reports, employee map, leadership dashboards
- Guest checkout or the consumer/home bar range
- Offline sync
- "Future AI": churn risk, basket completion, dynamic offers, case triage, NL search across TOTA360v5

Build so each of these can be connected in Phase 2 without redesign.

## Stack

- Next.js 15 (App Router), React 19, TypeScript strict — **static export** (`output: "export"`), no server runtime, no Catalyst dependency in UI code
- Tailwind CSS v4, shadcn/ui, Phosphor Icons (`@phosphor-icons/react`), Framer Motion
- Zustand: UI state only (filters, view prefs, basket, selection, notification state, theme, active persona)
- TanStack Query: all data fetching, through `src/lib/api/`
- React Hook Form + Zod for forms and validation
- PWA-ready shell (manifest, icons); no offline sync

## Folder structure

```
src/
  app/            routes: dashboard, account, price-list, configurator, shop, quotes (+ quotes/view),
                  orders (+ orders/view), invoices, stock, jobs (+ jobs/view), cases (+ cases/view),
                  knowledge (+ knowledge/view), products, documents, messages (+ messages/view),
                  notifications, onboarding — detail pages read ?id= (see Decision 1)
  components/
    ui/           shadcn/ui primitives
    shared/       AppShell, Sidebar, MobileBottomNav, Header, StatusPill, EmptyState, ...
    <feature>/    feature components (dashboard, quotes, orders, configurator, ...)
  features/       feature logic (hooks composing queries, derived view models)
  lib/
    api/          the data-access INTERFACE + TanStack Query keys; the only thing UI imports
    mock/         mock implementation of the interface, seed data, latency
    ai/           deterministic insight rules and assistant templates
  hooks/  stores/  types/  schemas/
public/products/  product images (saved locally, never hot-linked)
```

## Architecture rules

- **All data access goes through `src/lib/api/`.** Components and features never import from `src/lib/mock/`. Phase 2 replaces `src/lib/mock/` with Catalyst Functions / Data Store calls and adds Catalyst auth; nothing else should change.
- API functions mirror the endpoint table in BLUEPRINT.md (e.g. `GET /api/quotes` → `quotes.list()`), with request/response shapes matching production.
- The mock is scoped to the active persona's account, read from the Zustand persona store, with small realistic latency.
- Every response is parsed with its Zod schema at the API boundary.
- Types in `src/types/`, Zod schemas in `src/schemas/`; names follow TOTA360v5 / BLUEPRINT.md data model.
- IDs are strings; money is integer **pence** with a currency code; dates are ISO 8601 strings.
- Mock data must satisfy every consistency rule in BLUEPRINT.md (see "Mock data requirements"). `npm run check:data` runs a script that verifies every consistency rule and the volume minimums against the seeded data; it must pass before any milestone that touches mock data is committed.
- AI insights are computed from the mock data by the deterministic rules in `src/lib/ai/`, implemented exactly as written in BLUEPRINT.md, never hand-written. Every insight is labelled "Simulated insight" in the UI.
- Page components compose; data fetching stays out of presentational components; business logic stays out of UI.

## Coding standards

- TypeScript strict, no `any` unless unavoidable (and commented why).
- Zod at every boundary (API responses, forms, mock JSON such as configurator rules).
- Semantic HTML, accessible labels, keyboard-operable everything (configurator fully by keyboard), visible focus, accessible dialogs and sheets, screen-reader status messages, charts with text summaries.
- Every data-driven screen has loading, empty, error and success states. No blank screens.
- Mobile-first; mobile, tablet, desktop, large desktop. Desktop sidebar, mobile bottom nav and bottom sheets.
- Light and dark mode via theme tokens only. Primary brand token derived from `#1A75BC`; no hard-coded colours in components (TOTA360v5 will re-theme per client).
- Systematic status colours: neutral, success, warning, danger; consistent stage colours for quotes, orders, cases.
- Phosphor Icons only. No emoji icons, no Lorem Ipsum, no placeholder copy, no decorative charts.
- Every dashboard card has an action and drills into its records. Every record links to its related records.
- Motion: Framer Motion, fast, spring-based where natural, never decorative, respects `prefers-reduced-motion`.
- Consistent naming, no premature abstraction. Match the surrounding code.
- UK English in UI copy; GBP formatting `£1,234.56`; UK date formats.

## Mock data

UK drinks and hospitality trade, Huddersfield outward (Yorkshire, North West, North East, Midlands, London, Scotland, plus Ireland, Netherlands, UAE exports). Invented but plausible account and people names only; never imply a mock account is a real Brewfitt customer. Products use Brewfitt's real category structure, images and descriptions from brewfitt.com; spec sheets show as "not yet available". Volumes and consistency rules are in BLUEPRINT.md and are acceptance criteria.

## Personas (in place of auth)

The persona switcher stands in for authentication. Personas: customer contact (pick from several customer accounts, at least one not on account), site contact within a pub group (sees own site), group contact (sees all sites with roll-up, can switch into any site), supplier contact. Switched from the user menu.

## Workflow

- Follow BLUEPRINT.md's suggested build order.
- Do not build anything under the Phase 1 boundary. Do not add features BLUEPRINT.md does not ask for without checking with the user.
- After each milestone: `npm run typecheck`, `npm run lint`, `npm run build` (plus `npm run check:data` once mock data exists); fix failures; commit with a clear message; give the user a one-paragraph summary plus anything needed from them.
- Do not push unless asked.

## Milestones

Numbered from the build order in BLUEPRINT.md:

- **M0** Scaffold: Next.js 15 static export, TypeScript strict, Tailwind v4 theme tokens (light/dark from `#1A75BC`), shadcn/ui, tooling and scripts, logo in `public/`
- **M1** Types and Zod schemas for every data-model entity
- **M2** Product catalogue from brewfitt.com (images to `public/products/`), seeded mock data, mock API behind `src/lib/api/`, `check:data` script
- **M3** App shell, navigation, persona switcher, reset demo data
- **M4** Dashboard · **M5** Account 360 · **M6** Price list and shop · **M7** Configurator · **M8** Quotes · **M9** Orders and deliveries · **M10** Invoices and payments · **M11** Stock · **M12** Supplier screens · **M13** Cases and jobs · **M14** Knowledge and documents · **M15** Messages and notifications · **M16** AI insights and assistant · **M17** Onboarding · **M18** Polish, states, accessibility, motion

## Decisions from first session (17 September 2026)

Agreed with the user before M0. Where these conflict with anything above or in BLUEPRINT.md, these win.

1. **Detail routes:** static export cannot pre-render records created at runtime, so detail screens use query-string routes (`/quotes/view?id=…`, `/orders/view?id=…`, `/jobs/view?id=…`, `/cases/view?id=…`, `/knowledge/view?id=…`, `/messages/view?id=…`) instead of `[id]` folders. Accepted for Phase 1.
2. **Mock persistence:** the mock database persists in browser storage so the configurator → quote → order → delivery → invoice journey survives reloads. The user menu has a "Reset demo data" action.
3. **Mock dates:** all mock dates are generated as offsets from the current date, so data always looks current; AI insights stay deterministic because they use the same clock.
4. **Non-account customer:** the customer contact persona lets the tester pick from a small set of customer accounts, at least one of which is not on account (no credit terms), to exercise the mock card checkout and invoice payment.
5. **Logo:** `brand/Brewfitt-Master-Logo-2015_Rect.jpg` (white serif wordmark on `#1A75BC`). Use a text wordmark fallback only if it is missing.
6. **Product images:** fetch images and descriptions from brewfitt.com (Brewfitt is the client) and save them under `public/products/`. Realistic variants (sizes, tap counts) may share an image to reach 120+ products.
7. **Invoice.orderType:** Invoice gets an `orderType` field (sales, purchase), mirroring Delivery, so supplier self-bills reference purchase orders. Credit notes reference the original invoice's order.
8. **VAT:** flat mock 20% on UK accounts, 0% on export accounts (Ireland, Netherlands, UAE). Not a real VAT calculation.
9. **Exports:** CSV exports are real client-side downloads. PDFs are a styled on-screen preview with print; no PDF files are generated.
10. **Pub-group sites:** site accounts inherit the group's price list and account team; credit limit and terms are held at group level.

Also agreed: pin Next.js 15 as specified; commit milestones locally and do not push unless asked.
