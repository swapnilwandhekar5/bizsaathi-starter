# BizSaathi Starter (v0.1)

A low-budget, browser-based prototype for a future multi-business SaaS billing, inventory and trading platform.

## Requirements
- Node.js 20.19+ or a current supported Node.js LTS release
- npm

## Run locally
1. Extract this ZIP.
2. Open a terminal in the `bizsaathi-starter` folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL shown by Vite (usually `http://localhost:5173`).

## What works in this prototype
- Dashboard with sales, purchase, stock and simple gross-profit summary
- Add products, prices, costs, stock and configurable demo tax rates
- Create a demo sales invoice and decrease stock
- Record purchases and increase stock
- Add customers and expenses
- Business profile settings
- Basic reports
- Export current browser data as JSON
- Responsive layout for desktop, tablet and mobile browsers
- Browser localStorage persistence

## Important limitations — do not use for live business yet
This is a **front-end prototype**, not production SaaS software.
- Data is stored in the current browser only. Clearing browser data can remove it.
- There is no real registration, password login, server database, tenant isolation, team access, cloud backup or audit trail.
- GST/tax rates are user-configured demo values. The app does not validate GSTIN, determine correct tax treatment, file GST returns, generate compliant statutory invoices, or integrate e-invoice/e-way-bill APIs.
- No payment gateway or real subscription enforcement is connected. Plan prices are illustrative placeholders.
- Accounting is incomplete and does not implement full double-entry bookkeeping, reconciliation, returns, credit notes or statutory financial statements.
- Do not enter real customer data, sensitive information or rely on these reports for tax filing or accounting.

## Recommended next development steps
1. Add a backend API (e.g. NestJS) and PostgreSQL database.
2. Implement secure authentication and tenant/business membership model.
3. Enforce tenant scoping on every server request and add automated cross-tenant security tests.
4. Move products, customers, invoices, stock movements and expenses from localStorage into the database.
5. Use database transactions for invoice + stock + accounting postings; add idempotency and immutable audit records.
6. Add validated GST logic reviewed by an Indian GST professional.
7. Add backups, monitoring, rate limiting, secrets management and production deployment checks.
8. Integrate a supported payment gateway and enforce subscription limits server-side.

## Suggested future project structure
```text
bizsaathi/
  apps/
    web/              # Next.js/React responsive UI
    api/              # NestJS REST API
  packages/
    shared/           # shared types and validation schemas
  prisma/             # schema and migrations (if Prisma is chosen)
  infra/              # deployment configuration and runbooks
  tests/              # unit, integration and tenant-isolation tests
```

## Reset demo data
Use **Business Settings → Reset demo data**. Export a JSON backup first if you need to keep the current demo state.
