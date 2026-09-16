# Brewfitt Customer & Supplier Portal — TOTA360v5 Phase 1 Blueprint

As of 16 September 2026 · Flowseasy

## Sanity check: what changed from the source blueprint

The source document was a construction-CRM blueprint (Ross Construction / ParkPal) with Brewfitt pasted over the top. About 60% of it described the wrong product. This version keeps the good structure (mock-first Phase 1, stack, design bar, acceptance criteria) and replaces the content.

| Problem in the source | What this version does |
| --- | --- |
| Miami / South Florida geography, civil engineering projects, Ross Construction onboarding, "Parkpal render onto PHLP map", plot/caravan IDs, workforce capacity, safety risk | Removed. Mock data is UK hospitality and drinks trade, Huddersfield/Yorkshire outward |
| Audience contradiction: portal is for customers and suppliers, but Team, Reports, employee-only Map and workforce notifications are internal | Portal is external only. Brewfitt staff work in TOTA360v5. Internal views are listed as out of scope |
| Configurator, shop, price lists, stock, quote acceptance, order tracking, delivery changes, invoices/payments, knowledge base, supplier offers each mentioned once, never specified | Each has its own functional section, screen, endpoints and data model entities |
| Data model built on Opportunity / Job / Project; no Product, PriceList, Configuration, SalesOrder, Invoice, Delivery, Stock, Warranty | Data model rebuilt around the transactional objects TOTA360v5 already holds |
| Mock endpoints mirrored the CRM template | Endpoints mirror the TOTA360v5 Catalyst API surface the portal will call |
| Two dashboard lists that disagreed ("seven items" listing eight; screen spec listing pipeline/opportunities) | One prioritised dashboard list per persona |
| AI examples about jobs, lodges and staffing plans | AI reframed to stock-out risk, reorder timing, product suggestions, quote follow-up and invoice ageing |
| Stack said Next.js/Vercel with no mention of where it runs | Catalyst hosting and auth named explicitly so Phase 2 is a swap, not a rewrite |

Kept deliberately: the customer and supplier command centres remain the signature experience. That is the right hook.

## Project objective

Build the Brewfitt Portal: a self-service customer and supplier portal that is part of TOTA360v5 and is fed entirely by it. Customers log in to see their own price list, configure dispense systems, buy stock items, accept quotes, track orders and deliveries, see invoices and account status, and talk to the Brewfitt team. Suppliers log in to see what Brewfitt buys from them, respond to requests for quotation, submit product data and offers, and track purchase orders and payments.

The portal replaces the B2B login Brewfitt asked for on their website; the website shop stays open for consumers and small non-account buyers, and in Phase 2 both read from TOTA360v5. Everything the portal shows already lives in TOTA360v5: products, price lists, the configurator, stock, quotes, orders, invoices and communications.

### Phase 1 boundary

Phase 1 is frontend only. Build the complete portal UI against a mock API layer with realistic mock data and deterministic mock AI, so the experience can be tested and signed off by Brewfitt before it is wired to TOTA360v5.

Do not implement in Phase 1:

- Production backend, database or Catalyst functions
- Authentication or authorisation (a mock persona switcher stands in for login)
- Payments or card processing
- Real pricing, VAT or stock calculations
- Real AI or ML
- Real document storage
- Real email mirroring or WhatsApp integration (threads show both channels on mock data)
- Production sync with TOTA360v5, Zoho CRM or Zoho Books

Build so that each of these can be connected in Phase 2 without redesigning the product.

## Business context

[Brewfitt Limited](https://www.brewfitt.com/) is a Huddersfield, West Yorkshire company with around 60 years' trading and roughly 20 staff. It assembles, stocks and sells drink dispense solutions, mainly B2B and mainly in the UK, with some export. Customers include breweries, drinks brand owners, pub groups, independent pubs, bars, restaurants and hotels. Suppliers include manufacturers of dispense equipment and components.

Brewfitt runs Zoho One (CRM for customer interactions) and Order Management v4 (OMv4), a Zoho Creator ERP built by Flowseasy, for stock, sales and purchasing. Flowseasy is moving them to TOTA360v5, the Zoho Catalyst successor to OMv4. TOTA360v5 is the system of record and the sole data provider to the portal.

The problems the portal solves:

1. Brewfitt sends customers to a website shop that is disconnected from the price lists, configurator and stock in the ERP, and then has to sync website orders back by hand.
2. Orders arrive by phone and email and are keyed into OMv4 by the office team.
3. Customers cannot see their own quotes, orders, deliveries, invoices or account position without asking.
4. Suppliers have no view of what Brewfitt needs, when, or where their purchase orders and payments stand.
5. Communication is scattered across email, phone and WhatsApp with no shared thread against the transaction.

Brewfitt's ask on 16 September 2026 was a B2B login on their website with a configurator, items for sale and customer price lists. This blueprint delivers that inside TOTA360v5 instead, which keeps a single source of truth and adds the supplier side.

## Users

The portal has two external personas. A logged-in contact belongs to one account, and an account is either a customer or a supplier. A company that is both (rare, but possible) gets two logins. Pub groups and multi-site operators have a group account with site accounts beneath it: a site login sees its own site, a group login sees every site with roll-up totals and can switch into any site.

### Customer contact

A buyer, bar manager, operations lead or technical manager at a brewery, brand owner, pub group, pub, restaurant or hotel.

Goals: see the products and prices that apply to them, configure a dispense system and get a quote, reorder stock items, accept quotes, track orders and deliveries, see invoices and pay or check account status, log after-sales and warranty issues, find technical documents, and talk to their Brewfitt contact.

### Supplier contact

A sales or account manager at a manufacturer or distributor Brewfitt buys from.

Goals: see what Brewfitt buys from them and how that is trending, respond to requests for quotation, submit product data (images, spec sheets, branding) and offers for Brewfitt approval, see stock levels of their items at Brewfitt, track purchase orders, deliveries and payments, upload insurance and compliance documents, and talk to their Brewfitt contact.

### Out of scope: Brewfitt staff

Brewfitt employees and leadership work in TOTA360v5. Every portal action (quote accepted, order placed, message sent, product submitted) surfaces there for them. The portal does not include internal views: no team workload, no pipeline reports, no employee map, no leadership dashboards. Those belong in TOTA360v5 and are specified separately.

## User journeys

### Journey 1: Customer command centre

1. Customer opens the portal and lands on their dashboard.
2. Sees account status: balance, overdue amount, credit available, next payment due.
3. Sees quotes awaiting their acceptance, with values and expiry dates.
4. Sees open orders by stage (confirmed, picking, dispatched, delivered) and next delivery dates.
5. Sees stock position of the products they buy regularly, with a one-tap reorder.
6. Sees offers and suggested products chosen for them, with a plain-English reason ("you buy X every 6 weeks, it is due", "customers like you also buy Y").
7. Sees open conversations with Brewfitt and any message needing a reply.
8. Sees open after-sales or warranty cases.
9. Can ask the assistant "what's the latest on the Premium Lager font order?" and get a summary drawn from quotes, orders, deliveries and messages.
10. Moves into the configurator to build a system and request a quote.
11. Moves into the shop to order stock items at their price-list price.
12. Opens Account 360 to change delivery addresses, contacts or details.
13. Opens the knowledge centre for manuals, install guides and videos.
14. Knows who their Brewfitt account manager and technical contact are.

### Journey 2: Supplier command centre

1. Supplier opens the portal and lands on their dashboard.
2. Sees account status: what Brewfitt owes them, by ageing, and next payment run.
3. Sees requests for quotation awaiting their response, with deadlines.
4. Sees open purchase orders by stage (issued, acknowledged, in transit, received) and expected dates.
5. Sees Brewfitt's stock position of their items and a demand forecast by item.
6. Sees purchase history by product and month, and how they rank among Brewfitt's suppliers in their category.
7. Sees products they have submitted and their approval status.
8. Sees open conversations with Brewfitt.
9. Submits a new product or an offer: images, branding, spec sheet, price, lead time.
10. Contributes an article or document to the knowledge centre for Brewfitt approval.
11. Opens Account 360 to update details and upload insurance certificates with expiry dates.
12. Knows who their Brewfitt buyer is.

## Functional requirements

### Dashboard

The dashboard answers "where do I stand with Brewfitt and what needs my attention?" in 30 seconds. Every card carries an action and drills into the underlying records. No decorative charts.

Customer dashboard, in priority order:

1. Account status: balance, overdue by ageing band (current, 30, 60, 90+), credit limit and headroom, next payment due
2. Quotes awaiting acceptance, with expiry
3. Orders by stage and next delivery dates
4. Stock position of frequently bought products, with reorder
5. Offers and suggested products, each with a reason
6. Open conversations and messages needing a reply
7. Open after-sales and warranty cases (and job status where Brewfitt supplies and installs)
8. Your Brewfitt contacts

Supplier dashboard, in priority order:

1. Account status: amounts due to you by ageing, next payment run
2. Requests for quotation awaiting response, with deadlines
3. Purchase orders by stage and expected dates
4. Brewfitt stock of your items and forecast demand
5. Product submissions and their approval status
6. Open conversations
7. Purchase history and supplier ranking
8. Your Brewfitt contacts

### Account 360

One screen per account. Company details, company registration and VAT numbers, payment terms, credit limit (customers) or agreed terms (suppliers), billing address, multiple delivery addresses with default and per-site notes, contacts with roles, compliance documents (insurance certificates with expiry dates and Brewfitt approval status), agreements with each party, relationship summary, Brewfitt account team, and activity timeline. Contacts can edit details; edits are shown as pending until Brewfitt approves them in TOTA360v5 (mock this as an approval state).

### Price lists

Each customer sees only their assigned price list. The list shows product, SKU, unit, pack size, your price, list price where discount is shown, and stock status. Searchable and filterable by category. Downloadable as PDF or CSV (mock). Suppliers see the products they supply with the agreed cost price and lead time.

### Configurator

The configurator lets a customer build a dispense system step by step and turns it into a quote request. Steps, each with validation: venue type and site (existing delivery address or new); number of dispense points and products per point (beer, cider, lager, soft, water, coffee); font style and branding; cooling (remote cooler, python length, flash cooler); gas (CO2, mixed gas, regulators); ancillaries (drip trays, cleaning kits, glassware). Each step shows compatible options only, live running price at the customer's price-list price, and a bill of materials. Output: a saved Configuration with a name and a "Request quote" action that creates a Quote in Draft with the BOM as lines. Configurations can be duplicated and edited. Rules and compatibility come from mock JSON. Brewfitt defines the rules; Flowseasy captures them in a workshop and the mock JSON is the first draft of the TOTA360v5 configurator definition.

### Shop

Catalogue of stock items at the customer's price. Category browse, search, product page with images, spec sheet, related items and stock status. Basket with quantities, delivery address, requested delivery date, PO reference and notes. Checkout creates a Sales Order. Customers on account confirm without payment; customers with a login but no credit terms see a mock card step (real payment provider in Phase 2). Out-of-stock items offer notify-me. The website shop stays open for B2C and small non-account buyers, so the portal shop covers the trade range (Cellar, Bar, Mobile dispense) and does not need guest checkout. Quick reorder from order history.

### Quotes

Customers see every quote with status (draft, sent, accepted, declined, expired), lines, totals, validity date and the PDF. They can accept, decline with a reason, or ask a question in the quote's thread. Accepting converts the quote to a Sales Order. Suppliers see requests for quotation from Brewfitt and respond with price, lead time and notes, creating a supplier quote.

### Orders and deliveries

Sales orders (customer) and purchase orders (supplier) show lines, stage, delivery address, requested and confirmed dates, carrier and tracking where present, delivery notes and proof of delivery. Customers can request a change of delivery date or address up to the point of dispatch; the request goes to Brewfitt for approval. Partial deliveries and back-orders are shown per line.

### Invoices, credits and payments

Invoices and credit notes with status, due date, ageing and PDF. Statement view with running balance. Customers not on account can pay an invoice (mock). Suppliers see Brewfitt's self-billing or their invoices, remittance advices and scheduled payment runs.

### Stock

Customers see stock status (in stock, low, out, on order with date) for the products on their price list. Suppliers see Brewfitt's stock holding of their items, minimum levels and forecast demand.

### Jobs (supply and install)

Where Brewfitt installs, the customer sees the job: site, scheduled date, engineer, status, completion, sign-off and warranty start. Not every customer has jobs.

### After-sales and warranty

Customers raise a case against a product, order or job: fault description, photos, urgency. They see status, engineer notes and resolution. Warranty status per installed item.

### Knowledge centre

Searchable library of product manuals, install guides, cleaning and maintenance guides, spec sheets, videos and FAQs, tagged by product and category. Suppliers can submit articles and documents for Brewfitt approval. Customers see approved content only.

### Documents and agreements

Brewfitt's insurance certificates and company documents for download. Supplier insurance and compliance uploads with expiry dates and approval status. Agreements between Brewfitt and the account. Every transactional PDF (quote, order, delivery note, invoice) is also reachable here with its related record.

### Communications

Every quote, order, case and product submission has a message thread. Messages sent from TOTA360v5 by email appear in the same thread. A general inbox lists all threads. WhatsApp is shown as a channel indicator on messages in Phase 1 only; no real integration.

### Notifications

Actionable only. Quote awaiting acceptance, quote expiring, order confirmed, dispatched, delivered, delivery date changed, invoice due, invoice overdue, new message, product suggestion, stock-out risk on a regular item, case updated, product submission approved or rejected, RFQ received (supplier), payment run scheduled (supplier). Grouped Today / Earlier, mark read, open record, dismiss.

### Supplier offers and product submissions

Suppliers submit products (name, SKU, category, images, branding assets, spec sheet, cost price, lead time, minimum order) and time-limited offers. Each submission has a status: submitted, under review, approved, rejected with reason. Approved products become available to Brewfitt in TOTA360v5.

## AI capabilities

The primary AI feature is proactive commercial intelligence drawn from the account's own history: what they buy, how often, what similar accounts buy, and where stock or timing puts a sale or supply at risk. Phase 1 mocks this deterministically. Every mock output is labelled "Simulated insight" in the UI.

### Insight structure

Every insight communicates five things:

| Field | Customer example | Supplier example |
| --- | --- | --- |
| What is happening | You usually reorder CO2 cylinders every 5 weeks; the last order was 6 weeks ago | Brewfitt's stock of your flash coolers is below minimum |
| Why it matters | Running out mid-service loses trade | A purchase order is likely within 2 weeks |
| Value at stake | Estimated £180 to £320 order | Estimated £4,000 to £6,500 order |
| Confidence | Low / Medium / High | Low / Medium / High |
| Recommended action | Reorder now; 12 in stock at Brewfitt | Confirm lead time and current price |

### Insight categories

- Reorder due: a regular item is past its usual interval
- Stock-out risk: an item the account buys is low or out at Brewfitt
- Product suggestion: similar account types buy an item this account does not
- Quote follow-up: an open quote is near expiry with no activity
- Invoice ageing: an invoice is approaching or past due
- Demand forecast (supplier): projected purchases by item for the next 3 months
- Assistant: natural-language question over the account's own records ("what's the latest on the Premium Lager font order?") answered with a summary that links to each source record

### Deterministic mock logic

- If daysSinceLastOrder of a product > 1.2 × averageIntervalDays, return Reorder due (High if > 1.5×)
- If stockOnHand < minimumLevel for a product the account bought in the last 12 months, return Stock-out risk
- If an item is bought by ≥ 40% of accounts of the same sector and not by this account, return Product suggestion (Medium)
- If a quote expires within 7 days and has no message or view in 5 days, return Quote follow-up
- If an invoice is due within 5 days or overdue, return Invoice ageing (High when overdue > 30 days)
- Supplier forecast = average monthly purchases over 6 months × seasonal factor from mock data
- Assistant answers are composed from a template over the mock records matching the product or order named

### Future AI (not built in Phase 1)

Churn risk, basket completion, dynamic offer generation, automated case triage, natural-language search across TOTA360v5.

## Screen specifications

Each screen states who is using it, why they are there and the decision or action they are making.

| # | Screen | Persona | Purpose | Key content |
| --- | --- | --- | --- | --- |
| 1 | Dashboard | Both | 30-second relationship health and what needs action | Persona-specific card set from Functional requirements; assistant prompt; recent activity |
| 2 | Account 360 | Both | Single source of truth for the account | Identity, contacts, addresses, terms, compliance documents, agreements, Brewfitt team, timeline, stats (spend or purchases by month, top products) |
| 3 | Price list | Customer | Know what you pay | Searchable list, category filters, stock status, download |
| 4 | Configurator | Customer | Build a system and request a quote | Stepper, live BOM and price, saved configurations |
| 5 | Shop | Customer | Buy stock items | Catalogue, product page, basket, checkout, quick reorder |
| 6 | Quotes | Both | Accept, decline or respond | List by status, detail with lines, PDF, thread, accept/decline; supplier RFQ response form |
| 7 | Orders | Both | Know where every order is | List by stage, detail with lines, deliveries, tracking, change-request |
| 8 | Invoices and payments | Both | Know what is owed and pay | List, ageing, statement, PDF, mock pay; supplier remittances and payment runs |
| 9 | Stock | Both | See availability and demand | Customer: status per product; supplier: Brewfitt holding and forecast per item |
| 10 | Jobs | Customer (with installs) | Track supply and install | List, job detail, engineer, sign-off, warranty |
| 11 | Cases | Customer | Raise and track after-sales issues | Case form, list, detail with thread |
| 12 | Knowledge centre | Both | Find product knowledge | Search, categories, article, video, document; supplier submission |
| 13 | Products and offers | Supplier | Submit and track products | Submission form, list with approval status, offers |
| 14 | Documents | Both | Central document context | Search, category, related record, owner, date, preview |
| 15 | Messages | Both | Talk to Brewfitt | Inbox of threads, thread view, compose, channel indicator |
| 16 | Notifications | Both | Act on alerts | Today / Earlier, mark read, open, dismiss |
| 17 | Onboarding | Both | First-run tour | Purpose, dashboard, configurator or products, quotes and orders, AI insights, land on dashboard |

### Navigation

Customer desktop sidebar: Dashboard, Configurator, Shop, Price list, Quotes, Orders, Invoices, Stock, Jobs, Cases, Knowledge, Documents, Messages.

Supplier desktop sidebar: Dashboard, RFQs and quotes, Purchase orders, Payments, Stock and forecast, Products and offers, Knowledge, Documents, Messages.

Persistent utilities: global search, notifications, assistant, user menu (account, switch persona in Phase 1 mock, theme, sign out).

Primary CTA, context-aware: New configuration, New order, Reorder, Raise case, New message (customer); Respond to RFQ, Submit product, New offer, New message (supplier).

Mobile bottom navigation, customer: Home, Shop, Orders, Messages, More. Supplier: Home, RFQs, Orders, Messages, More. Search and notifications reachable from every screen.

## Design philosophy

The portal should feel premium, modern, calm, operational and trustworthy: data-rich without being dense, AI-native, and at home in the drinks and hospitality trade. Design inspiration: Apple, Airbnb, Arc Browser, Linear. Brewfitt has no brand guidelines beyond the logo and colours on brewfitt.com; derive theme tokens from those and choose typography in the build. Do not hard-code them.

Brand assets supplied: `brand/Brewfitt-Master-Logo-2015_Rect.jpg` (white serif wordmark on brand blue). Brand blue is `#1A75BC`; white `#FFFFFF`. Use the blue as the primary token and derive tints, shades and a dark-mode variant from it. The logo wordmark uses a serif; the UI typography need not, but should sit comfortably beside it.

Avoid: generic admin dashboards, Bootstrap or Material defaults, excessive tables, tiny typography, emoji icons, decorative charts, placeholder copy, Lorem Ipsum.

### Visual language

Generous whitespace, premium typography, rounded cards, subtle borders, layered surfaces, clear hierarchy, floating controls where useful, strong data visualisation, high-quality product imagery, restrained emphasis for status and risk. Phosphor Icons throughout. Light and dark modes required. Colour semantics systematic: neutral for normal, clear success, warning and danger treatments, consistent stage colours for quote, order and case stages. Theme tokens only; no fixed style that blocks per-client theming, because TOTA360v5 will serve other Flowseasy clients.

### Responsive strategy

Mobile-first. Support mobile, tablet, desktop and large desktop. Desktop uses multi-column layouts and persistent sidebar. Tablet keeps the hierarchy without becoming a squeezed desktop. Mobile prioritises one-handed use, bottom navigation, bottom sheets, stacked cards, compact charts, fast search, quick reorder. Bar managers will use this on a phone in a cellar; buyers will use it on a desktop. One product, one experience, different arrangement.

### Onboarding

A polished first-run tour on mock data, per persona: purpose of the Brewfitt Portal, the dashboard, the configurator and shop (customer) or products and RFQs (supplier), quotes and orders, simulated AI insights, then land on the dashboard. Framer Motion for transitions.

## Technology stack

- Next.js 15, React 19, TypeScript strict
- Tailwind CSS v4, shadcn/ui, Phosphor Icons, Framer Motion
- Zustand for UI state (filters, view preferences, basket, selected records, notification state, theme, active persona)
- TanStack Query for mock data fetching (accounts, products, price lists, configurations, quotes, orders, deliveries, invoices, stock, cases, documents, knowledge, messages, insights)
- React Hook Form and Zod for forms and validation
- Mock API layer with small realistic latency
- PWA-ready architecture

### Catalyst fit

The portal is a Zoho Catalyst web client of TOTA360v5. Phase 1 builds it as a static Next.js export that runs anywhere, with no Catalyst dependency in the UI code. In Phase 2 it is hosted on Catalyst (Web Client Hosting for the static export, or AppSail if server rendering is needed), authentication moves to Catalyst Authentication with portal contacts as end users linked to a TOTA360v5 account, and the mock API is replaced by Catalyst Functions and Data Store calls. Keep all data access behind an `api/` interface so this swap touches one folder. Keep the mock endpoint shapes aligned with the TOTA360v5 Catalyst API as it stands today; where an endpoint does not yet exist in TOTA360v5, the mock defines the contract Flowseasy will build.

## Mock API endpoints

All endpoints are scoped to the logged-in account; the mock reads the active persona from the Zustand store. Shapes should match production so Phase 2 is a transport swap.

| Area | Endpoints |
| --- | --- |
| Session | GET /api/me (contact, account, persona, brewfittTeam) |
| Account | GET /api/account · PATCH /api/account · GET/POST/PATCH /api/account/addresses · GET/POST/PATCH /api/account/contacts · GET/POST /api/account/documents |
| Products | GET /api/products · GET /api/products/:id · GET /api/categories |
| Price list | GET /api/price-list · GET /api/price-list/export |
| Configurator | GET /api/configurator/rules · GET/POST/PATCH /api/configurations · POST /api/configurations/:id/request-quote |
| Shop | GET/POST/PATCH /api/basket · POST /api/checkout |
| Quotes | GET /api/quotes · GET /api/quotes/:id · POST /api/quotes/:id/accept · POST /api/quotes/:id/decline · GET /api/rfqs · POST /api/rfqs/:id/respond |
| Orders | GET /api/sales-orders · GET /api/sales-orders/:id · POST /api/sales-orders/:id/change-request · GET /api/purchase-orders · GET /api/purchase-orders/:id · POST /api/purchase-orders/:id/acknowledge |
| Deliveries | GET /api/deliveries · GET /api/deliveries/:id |
| Invoices | GET /api/invoices · GET /api/invoices/:id · GET /api/credit-notes · GET /api/statement · POST /api/invoices/:id/pay · GET /api/payments · GET /api/payment-runs |
| Stock | GET /api/stock · GET /api/stock/forecast (supplier) |
| Jobs | GET /api/jobs · GET /api/jobs/:id |
| Cases | GET/POST /api/cases · GET/PATCH /api/cases/:id |
| Knowledge | GET /api/knowledge · GET /api/knowledge/:id · POST /api/knowledge/submissions |
| Supplier products | GET/POST /api/supplier-products · PATCH /api/supplier-products/:id · GET/POST /api/offers |
| Documents | GET /api/documents · GET /api/documents/:id |
| Messages | GET /api/threads · GET /api/threads/:id · POST /api/threads/:id/messages · POST /api/threads |
| Notifications | GET /api/notifications · PATCH /api/notifications/:id |
| AI | GET /api/ai/insights · GET /api/ai/products/:id/insight · POST /api/ai/ask |

## Data model

Typed domain models in `types/`, validated with Zod in `schemas/`. Names follow TOTA360v5 where it already has the object. Every id is a string; every money value is in pence with a currency code; every date is ISO 8601.

| Entity | Fields |
| --- | --- |
| Account | id, name, kind (customer, supplier), parentAccountId, isGroup, sector (brewery, brand owner, pub group, pub, restaurant, hotel, manufacturer, distributor), companyNumber, vatNumber, paymentTerms, creditLimit, onAccount, priceListId, billingAddressId, accountManagerId, technicalContactId, buyerId, relationshipHealth, lastContactAt, createdAt, updatedAt |
| Contact | id, accountId, name, title, email, phone, role (buyer, bar manager, technical, finance, sales), isPrimary, canApprove |
| Address | id, accountId, label, line1, line2, town, county, postcode, country, latitude, longitude, isDefault, deliveryNotes |
| Product | id, sku, name, category, subcategory, description, images, specSheetDocumentId, unit, packSize, listPrice, supplierId, leadTimeDays, active |
| PriceList | id, name, currency, validFrom, validTo; PriceListLine: priceListId, productId, price, discountPercent |
| StockPosition | productId, onHand, allocated, available, onOrder, expectedAt, minimumLevel, status |
| ConfiguratorRules | steps, options per step, compatibility constraints, defaults (JSON) |
| Configuration | id, accountId, name, siteAddressId, venueType, selections per step, lines (productId, qty, price), total, status (draft, quoted), quoteId, createdAt, updatedAt |
| Basket | id, accountId, lines, deliveryAddressId, requestedDate, poReference, notes |
| Quote | id, accountId, number, status (draft, sent, accepted, declined, expired), lines, subtotal, vat, total, validUntil, configurationId, pdfDocumentId, threadId, createdAt, updatedAt |
| Rfq | id, supplierId, number, lines (productId, qty, requiredBy), deadline, status; SupplierQuote: rfqId, lines with price and leadTime, notes |
| SalesOrder | id, accountId, number, status (confirmed, picking, dispatched, part-delivered, delivered, cancelled), lines (productId, qty, delivered, backordered, price), deliveryAddressId, requestedDate, confirmedDate, poReference, quoteId, total, threadId, createdAt |
| PurchaseOrder | id, supplierId, number, status (issued, acknowledged, in transit, part-received, received), lines, expectedDate, total, threadId |
| Delivery | id, orderId, orderType, number, status, carrier, trackingRef, dispatchedAt, deliveredAt, lines, proofDocumentId |
| ChangeRequest | id, orderId, kind (date, address), requested, current, status (pending, approved, rejected), reason |
| Invoice | id, accountId, number, kind (invoice, credit note, self-bill), status, issuedAt, dueAt, total, outstanding, ageingBand, orderId, pdfDocumentId |
| Payment | id, accountId, amount, method, paidAt, allocatedTo; PaymentRun: id, scheduledFor, total, invoiceIds |
| Job | id, accountId, orderId, siteAddressId, name, engineerName, scheduledDate, status, completionPercent, signedOffAt, warrantyStart, warrantyEnd |
| Case | id, accountId, productId, orderId, jobId, kind (fault, warranty, return, query), urgency, status, description, photos, resolution, threadId, createdAt |
| KnowledgeItem | id, title, type (manual, guide, video, faq, spec), category, productIds, summary, documentId or videoUrl, source (brewfitt, supplier), status, updatedAt |
| SupplierProduct | id, supplierId, name, sku, category, images, brandingAssets, specSheetDocumentId, costPrice, leadTimeDays, minimumOrder, status (submitted, under review, approved, rejected), reviewNote |
| Offer | id, supplierId, productIds, description, price, validFrom, validTo, status |
| Document | id, name, category (quote, order, delivery note, invoice, insurance, agreement, spec, manual), relatedType, relatedId, ownerAccountId, fileType, fileSize, expiresAt, approvalStatus, modifiedAt |
| Thread | id, subject, relatedType, relatedId, participants, lastMessageAt, unreadCount; Message: threadId, senderId, senderSide (brewfitt, account), channel (portal, email, whatsapp), body, attachments, sentAt |
| Notification | id, accountId, kind, title, body, relatedType, relatedId, read, createdAt |
| AIInsight | id, accountId, category, severity, title, whatIsHappening, whyItMatters, valueAtStake (low, high), confidence, recommendedAction, relatedType, relatedId, createdAt |
| BrewfittTeamMember | id, name, role, email, phone, avatar |

## Mock data requirements

Generate realistic, internally consistent UK drinks-trade data. No Lorem Ipsum, no John Doe, no real customer or supplier names; invented but plausible names only, and the app must not claim any mock account is a real Brewfitt customer. Products are the exception: use Brewfitt's real category structure and product imagery and descriptions from brewfitt.com (Cellar, Bar, Mobile dispense; Lindr dispensers, regulators, keg couplers, line cleaning, coolants, coolers, CoolTube, Foam Stop, gas chains, nitro, drip trays, taps and handles, fonts, clamp assemblies, badge holders, bottle and wine coolers, bar lighting, water dispense, slush machines). Save product images into the repo under `public/products/` rather than hot-linking brewfitt.com. No spec sheets exist in OMv4, so the mock shows spec sheets as not yet available and demonstrates them arriving through supplier submissions.

Volumes: 25+ customer accounts across breweries, brand owners, pub groups, pubs, restaurants and hotels; 10+ supplier accounts; 50+ contacts; 120+ products across fonts and taps, remote coolers, pythons, flash coolers, gas and regulators, kegs and couplers, cleaning and hygiene, drip trays and bar furniture, spares; 6+ price lists; 15+ saved configurations; 40+ quotes; 60+ sales orders; 25+ purchase orders; 80+ deliveries; 100+ invoices and credit notes; 20+ jobs; 15+ cases; 40+ knowledge items; 60+ documents; 30+ threads with 200+ messages; 8 Brewfitt team members.

Geography: Huddersfield head office; customers across Yorkshire, the North West, North East, Midlands, London and Scotland, with a few export accounts (Ireland, Netherlands, UAE). Postcodes and coordinates must be valid so a future map works.

Consistency rules: every quote, order, invoice, case and thread belongs to an account; every order line references a product on that account's price list; every delivery references an order; every invoice references an order; stock positions reconcile with on-order purchase orders; every AI insight corresponds to conditions present in the mock data; every supplier product references its supplier; every knowledge item references real products.

Seasonality: sales peak in spring and the run-up to summer and December; gas and cleaning consumables repeat on 4 to 8 week cycles; installs cluster around venue openings.

## Engineering standards

### Component library

Composable, typed, reusable: AppShell, Sidebar, MobileBottomNav, Header, GlobalSearch, NotificationCenter, AssistantPanel, UserMenu, PageHeader, KpiCard, ChartCard, AccountStatusCard, QuoteCard, OrderCard, OrderStageTracker, DeliveryTimeline, InvoiceCard, AgeingBar, ProductCard, ProductGrid, StockPill, PriceListTable, ConfiguratorStepper, ConfiguratorOptionCard, BillOfMaterials, Basket, BasketLine, CheckoutForm, CaseCard, JobCard, KnowledgeCard, DocumentCard, ContactCard, TeamMemberCard, ThreadList, MessageBubble, Composer, AIInsightCard, InsightList, SupplierProductForm, SubmissionStatusBadge, ForecastChart, StatusPill, StageBadge, RiskBadge, FilterBar, FilterSheet, DataTable, EmptyState, LoadingState, ErrorState, ConfirmDialog, Drawer, Modal, Sheet, Toast, CommandPalette, Timeline, ProgressIndicator, AvatarGroup, PdfPreview.

### Folder structure

`src/app/` with routes per screen (`dashboard`, `account`, `price-list`, `configurator`, `shop`, `quotes/[id]`, `orders/[id]`, `invoices`, `stock`, `jobs/[id]`, `cases/[id]`, `knowledge/[id]`, `products`, `documents`, `messages/[id]`, `notifications`, `onboarding`); `src/components/` grouped by feature plus `shared/` and `ui/`; `src/features/` for feature logic; `src/lib/api/` (interface), `src/lib/mock/` (implementation and data), `src/lib/ai/` (deterministic rules); `src/hooks/`, `src/stores/`, `src/types/`, `src/schemas/`.

### Coding standards

TypeScript strict, no `any` unless unavoidable. Zod at every boundary. Page components compose; data fetching stays out of presentational components; business logic stays out of UI. Semantic HTML, accessible labels, keyboard-accessible interactions, useful error messages, consistent naming, no premature abstraction. Mock API interfaces stay close to production interfaces.

### Motion

Framer Motion. Fast, spring-based where natural, never decorative, respects reduced motion. Page transitions, card entrance, drawer and sheet transitions, hover micro-interactions, filter transitions, KPI number transitions, configurator step transitions, basket updates, insight appearance, toasts. No excessive bouncing, no long loaders, no continuous motion.

### Accessibility

WCAG-conscious contrast, keyboard navigation, visible focus, semantic headings, form labels, screen-reader status messaging, accessible dialogs and sheets, reduced motion, charts with text summaries, the configurator fully operable by keyboard.

### Empty, loading and error states

Every data-driven screen has loading, empty, error and success states. Examples: no quotes awaiting you, no orders match these filters, nothing due for payment, no cases open, no insights right now, basket empty, no results in the knowledge centre. No blank screens.

### Performance and PWA

Fast initial render, lazy loading for charts and PDF previews, minimal client components, efficient lists, stable query caching, image optimisation, minimal layout shift. Installable app shell and app-like navigation; no offline sync in Phase 1.

## Acceptance criteria

Product: the portal feels like a complete self-service system a Brewfitt customer or supplier could use today once connected; every record links to its related records; navigation is obvious without training; a customer can go from configurator to quote to order to delivery to invoice without leaving the portal.

Dashboard: all eight items per persona present; every card drills into source data; simulated insights visible and labelled; assistant answers a product or order question from mock records.

Configurator: every step validates and offers only compatible options; live price uses the account's price list; a configuration saves and produces a quote request with a correct BOM.

Shop: browse, search, product page, basket, checkout create a sales order; quick reorder works from history; on-account and non-account checkout paths both work.

Quotes and orders: accept and decline change status and create the order; change requests record and show pending; stage trackers and delivery timelines are correct against mock data.

Invoices: ageing bands, statement balance and outstanding totals reconcile with mock invoices and payments.

Supplier: RFQ response, product submission with approval states, offers, stock and forecast, purchase orders and payment runs all function.

Knowledge and documents: search and filters work; supplier submissions show approval status; expiring insurance shows a warning.

Messages and notifications: threads attach to records; channel indicators show; notifications mark read, open and dismiss.

AI: every insight has what, why, value at stake, confidence and action, is labelled simulated, and is consistent with the mock data behind it.

UX and engineering: mobile-first and responsive; light and dark; premium visual language; smooth motion; every state covered; accessible; TypeScript strict; reusable components; mock API layer behind an interface; Zustand; TanStack Query; React Hook Form; Zod; Framer Motion; Phosphor Icons; clean architecture.

## Implementation instruction to Claude Code

Build the entire frontend as one coherent product, not as disconnected pages. Start from the data model and the two journeys. Build the mock data first and make it good; everything else is a view over it.

Every screen must answer: who is using this, why are they here, and what decision or action are they making. Prioritise information hierarchy over decoration. Make every navigation item, filter, drill-down, drawer, dialog, stepper, basket, thread and dashboard card functional against the mock API.

Suggested build order: types and schemas; mock data and mock API; app shell, navigation and persona switch; dashboard; account 360; price list and shop; configurator; quotes; orders and deliveries; invoices and payments; stock; supplier screens; cases and jobs; knowledge and documents; messages and notifications; AI insights and assistant; onboarding; polish, states, accessibility, motion.

Do not wait for backend requirements. Keep interfaces clean so TOTA360v5 on Catalyst can be connected in Phase 2 by replacing `src/lib/mock/` and adding Catalyst auth. The result should feel like a premium, AI-native dispense-trade portal inspired by Apple, Airbnb, Arc and Linear, and credible for a 60-year-old Yorkshire engineering and supply business.

## Decisions taken 16 September 2026

Answered by Flowseasy after the Brewfitt meeting. Each decision is reflected in the section it affects.

| Question | Decision | Effect on the build |
| --- | --- | --- |
| Configurator rules | Brewfitt defines them for the portal | Flowseasy runs a rules workshop with Brewfitt; mock rules JSON is the first draft of that output and becomes the TOTA360v5 configurator definition |
| Non-account card checkout | Needed | Mock card step is built in Phase 1; Phase 2 adds a payment provider. For trade customers with a portal login but no credit terms |
| Supplier portal timing | Same launch as customer portal | Supplier screens are in Phase 1 scope and acceptance criteria |
| Existing website shop | Stays open for B2C and a few small non-account B2B buyers | Portal serves trade customers with a portal login only; no guest checkout and no home bar range. Website and portal will both read from TOTA360v5 in Phase 2 so stock and pricing stay consistent |
| Supply and install | 15 to 20% of business | Jobs screen stays in Phase 1 |
| Communications | Portal messaging and email in Phase 1 UI; WhatsApp nice-to-have | Threads show portal and email messages in Phase 1 (mocked); real email mirroring is the first Phase 2 integration; WhatsApp is a channel indicator only |
| Multi-site pub groups | One login per site, plus a group view | Account gets a parent/child hierarchy; site contacts see their site, group contacts see all sites with roll-up |
| Brand guidelines | Logo and colours from the website only | Theme tokens derived from the supplied logo (`#1A75BC`) and brewfitt.com; typography chosen by the build |
| Product images and spec sheets | No spec sheets in OMv4; images available on brewfitt.com | Mock uses Brewfitt's own website product images and descriptions for illustration; spec sheets are shown as "not yet available" and collected through the supplier submission flow |
