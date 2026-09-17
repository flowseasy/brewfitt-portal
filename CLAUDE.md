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

## Tooling notes

- Scripts: `npm run dev`, `typecheck`, `lint`, `build` (static export to `out/`), `format`, `gen:types`, `check:data` (seed consistency for today and +45/+120/+250 days), `check:api` (every endpoint and mutation per persona, reload replay, reset).
- shadcn/ui: Radix base, `radix-nova` style, `iconLibrary: "phosphor"`. Add primitives with `npx shadcn@latest add <name>`. Generated files import `cn` from the `cn` package (shadcn's own). Never save `components.json` from PowerShell `Set-Content` (it writes a BOM, which breaks the CLI).
- ESLint enforces the boundaries: no `lucide-react`, no `next-themes`, and nothing outside `src/lib/api/` and `src/lib/mock/` may import from `@/lib/mock`.
- Accessibility audit: `axe-core` is a dev dependency. After `npm run build:check`, copy `node_modules/axe-core/axe.min.js` into `.next-build/`, load routes in same-origin iframes on the static preview, `eval` axe into each and run WCAG 2.1 AA rules. Set dark mode through the `brewfitt-theme` storage key before loading, not by toggling the class (transitions give false contrast failures). Last full pass (M18): no violations across customer, group and supplier routes in light and dark.
- A `<dl>` may only wrap `<dt>`/`<dd>` in `<div>`s: linked stat tiles put the link in the `<dt>` and stretch it with `after:absolute after:inset-0`.
- Theme: light by default; sun/moon `ThemeToggle` in the header and on the start screen, with Light/Dark/Match device in the user menu. `src/stores/theme-store.ts` (Zustand, persisted) + `ThemeSync` and a pre-paint boot script in the root layout. Dark mode is the `.dark` class. Tokens (brand, surfaces, status `neutral/info/success/warning/danger` with `-subtle` variants, charts) live only in `src/app/globals.css`.
- Typography: Inter for UI (sits beside the serif wordmark), JetBrains Mono for SKUs and references.
- Logo served from `public/brand/brewfitt-logo.jpg` (2230×560); app icon `src/app/icon.svg`.

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
- Schemas are written by hand in `src/schemas/`; `src/types/index.ts` is generated from them (`npm run gen:types`). Never hand-edit it.

## Data model interpretations (M1)

Where BLUEPRINT.md names a field without specifying it, these are the choices made:

- Enum values are kebab-case (`brand-owner`, `credit-note`, `part-received`, `under-review`).
- Money is `{ amount: pence, currency }`. Order and invoice `total` include VAT; order line `price` is the ex-VAT unit price. Quotes carry explicit `subtotal`, `vat` and `total`.
- Supplier agreed cost prices are a `PriceList` with `kind: "cost"` assigned via the supplier's `priceListId`; customer lists have `kind: "sell"`.
- Ageing bands are aged by invoice date as on a UK aged-debt statement: current < 30 days, `30` = 30–59, `60` = 60–89, `90+` ≥ 90. `ageingBand` and `overdue` status are computed at read time from the clock. The AI invoice-ageing rule uses days past `dueAt`.
- Fields added because a blueprint requirement needs them: `Account.pendingChanges` and `approvalStatus` on Contact/Address (edits pending Brewfitt approval); `Quote.lastViewedAt`, `salesOrderId`, `declineReason`; `Rfq.threadId/notes/createdAt`; `PurchaseOrder.createdAt` (purchase history by month); `Delivery.noteDocumentId`; `Case.number/subject/engineerNotes/updatedAt`; `KnowledgeItem.body/submittedByAccountId/reviewNote`; `SupplierProduct.productId/threadId/submittedAt/updatedAt`; `Thread.accountId`; `Message.id`; `Notification.dismissed`; `Payment.reference/remittanceDocumentId`; `PaymentRun.status`; ids on `SupplierQuote` and `PendingChange`; `AIInsight.simulated: true`.
- Agreements are Documents with category `agreement`, not a separate entity. Document categories extend the blueprint list with `proof-of-delivery`, `credit-note`, `remittance`, `compliance`, `company`.
- Payment runs are Brewfitt-wide; the API returns each run filtered to the supplier's own invoices and total.
- `ConfigurationSelections.dispense.optionIds` holds tap style, coupler and non-draught equipment. Configurator `OptionLine` can pick a product per dispense point by draught tap count (fonts, drip trays).

## App shell (M3)

- `src/app/page.tsx` is the Phase 1 start screen (choose a persona = sign in). Portal routes live in the `src/app/(portal)/` route group, whose layout renders `AppShell` (sidebar, header with site switcher, search, notifications, primary CTA, user menu; mobile bottom nav with More sheet and floating CTA). `AppShell` waits for persisted state (`useHydrated`) and redirects to `/` when signed out or to `/dashboard` when a route is not in the persona's navigation.
- Navigation per persona: `src/components/shared/navigation.tsx`. Record links: always use `hrefFor(relatedType, id)` from `src/lib/links.ts`.
- Session hooks: `usePersona`, `usePersonaKey` (prefix every query key), `useMe`, `useIsSupplier` in `src/features/session/use-session.ts`.
- Shared states: `LoadingState`, `EmptyState`, `ErrorState` (`states.tsx`), `StatusPill` tones, `PageHeader`, `ConfirmDialog`.
- `.claude/launch.json`: `brewfitt-portal` runs `next dev`; `brewfitt-portal-static` serves the static export in `.next-build/` on port 4173 via `scripts/serve-out.mjs`. For browser verification prefer the static preview after `npm run build:check`: the dev server's hot reload on Windows can leave pages stuck on the loading skeleton (chunk 404s) while files change. With a custom `distDir` Next writes the export into that directory, so `build:check` output is `.next-build/`; `npm run build` exports to `out/`.
- Detail pages that read `?id=` use `useSearchParams` inside a `<Suspense>` boundary (required for static export).
- Onboarding (`/onboarding`, outside the app shell): shown the first time each contact signs in or is switched to, tracked per contact in localStorage (`brewfitt-onboarding`, not cleared by Reset demo data); "Take the tour" in the user menu reopens it.
- Avoid `AnimatePresence mode="wait"` for navigation-critical content; it blocks the next view until exit animations finish, which stalls in throttled tabs. Exit animations in general can stall there, so step-by-step views use enter-only transitions.

## Mock layer (M2)

- `src/lib/api/`: `contract.ts` (the `PortalApi` interface, one method per blueprint endpoint), `index.ts` (`api`, every response Zod-parsed), `query-keys.ts` (keys prefixed by `personaKey(persona)`), `errors.ts` (`ApiError`, `errorMessage`).
- `src/lib/mock/`: `seed/` (deterministic generator, fixed RNG seed, all dates relative to today), `data/` (brewfitt.com catalogue JSON, UK postcodes from postcodes.io, configurator rules draft, knowledge and conversation content), `api/` (handlers), `scope.ts` (persona scoping), `db.ts`, `mutations.ts`.
- **Persistence (decision 2, as implemented):** the seed is regenerated on load (~50 ms). User changes are stored in localStorage as a log of computed record changes (insert/patch/remove with ids and timestamps) and replayed with dates shifted forward by days elapsed. Handlers must put everything into the change list via `commit(op, changes)`; never mutate `getDb()` directly. Bump `src/lib/mock/version.ts` when seed ids or shapes change.
- Read-time derivations: invoice `overdue` and `ageingBand`, quote `expired`.
- Contract additions defined by the mock (blueprint silent): `Me.credit` and `Me.vatRate`; `Statement.unallocatedCredit`; `supplierProducts.performance()`; `messages.threads()` returns `ThreadSummary` (thread plus `lastMessage`). Record PDFs open via `?pdf=1` on quote, order and invoice views.
- Business logic shared by UI and mock lives outside the mock: `src/lib/configurator/engine.ts` (compatibility, validation, BOM), `src/lib/ai/rules.ts` (insight rules), `src/lib/ai/assistant.ts`, `src/lib/format.ts`.
- Personas (`api.demo.personas()`): Olivia Bennett (Harbourside Drinks, brand owner, Premium Lager font rollout, default), Sarah Crowther (Pennine Stack Brewery), Kerry Flanagan (The Crown & Anchor, no credit terms, card), Lucy Carrington (Salt & Ember), Siobhan Kelly (Liffey Quarter Hotel, export 0% VAT), Jess Armitage (The Weaver's Rest, site), Andrew Hirst (Mill Race Inns, group), Neil Chapman (Vireo Dispense Systems, supplier).
- Catalogue: 245 real brewfitt.com trade products plus 5 python loom variants (per metre, sharing the site's mini python image; the site has no pythons). Prices the site does not show are estimates in `seed/catalogue.ts`. The site's "Special Offers" fonts are filed under Fonts. Suppliers are invented and mapped by category. No glassware, gas cylinders or slush machines exist on the site, so the configurator has none. Configurator rules are labelled "draft-1 (pre-workshop)"; thresholds await Brewfitt's rules workshop.

## Coding standards

- TypeScript strict, no `any` unless unavoidable (and commented why).
- Zod at every boundary (API responses, forms, mock JSON such as configurator rules).
- Semantic HTML, accessible labels, keyboard-operable everything (configurator fully by keyboard), visible focus, accessible dialogs and sheets, screen-reader status messages, charts with text summaries.
- Every data-driven screen has loading, empty, error and success states. No blank screens.
- Every CSS grid sets a base template (`grid grid-cols-1 sm:grid-cols-…`). A grid with only responsive columns sizes its implicit track to content, and `truncate` text then blows out the phone layout.
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
- After each milestone: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:data` and `npm run check:api`; fix failures; commit with a clear message; give the user a one-paragraph summary plus anything needed from them, then continue straight into the next milestone without waiting for a reply. Stop only when a decision genuinely needs the user.
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
11. **Quote to invoice journey (user, after M18):** a customer generates a quote from a configuration or from basket items ("Get a quote instead"); it is ready to accept at once (status `sent`, with PDF, conversation and notification), overriding BLUEPRINT.md's "Quote in Draft". Accepting creates the sales order. Brewfitt then packs, ships and delivers it, and the order's stages update over time: the mock applies them before each API response at `JOURNEY_MINUTES` in `src/lib/mock/api/journey.ts` (pack +2 min, ship +5 min with delivery note, tracking and, for credit accounts, the invoice; delivered +15 min with proof of delivery). Checkout orders follow the same journey. Accounts without credit terms keep being invoiced at order. Journeys live in the mock-only `journeys` collection and replay from the demo log.

Also agreed: pin Next.js 15 as specified; commit milestones locally and do not push unless asked.
