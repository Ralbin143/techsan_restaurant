# Step-by-Step Implementation Plan

## Phase 1 – Foundation (Week 1–2) ✅ Scaffolded

- [x] Monorepo structure
- [x] MongoDB models (22 collections)
- [x] Auth (JWT + refresh + RBAC)
- [x] Express API with Swagger
- [x] Docker Compose
- [x] Seed script

## Phase 2 – Core Operations (Week 3–4)

- [ ] Complete menu CRUD with image upload (S3)
- [ ] Table QR generation & printing
- [ ] Full order lifecycle testing
- [ ] Socket.IO integration in Flutter
- [ ] Customer QR ordering polish
- [ ] KDS sound alerts

## Phase 3 – Billing & Payments (Week 5)

- [ ] Razorpay webhook handler
- [ ] Split bill UI (waiter + cashier)
- [ ] Receipt PDF generation
- [ ] End-of-day cashier reports
- [ ] Thermal printer plugin (Flutter)

## Phase 4 – Inventory (Week 6)

- [ ] Purchase order workflow
- [ ] Barcode scanning for stock-in
- [ ] Low stock push notifications
- [ ] Waste management screens
- [ ] Inventory valuation reports

## Phase 5 – HR & Payroll (Week 7)

- [ ] Shift scheduling UI
- [ ] Attendance geo-fencing (optional)
- [ ] Payroll calculation engine
- [ ] Payslip PDF export
- [ ] Leave approval workflow

## Phase 6 – Analytics & Advanced (Week 8+)

- [ ] Chart.js dashboards (admin)
- [ ] PDF/Excel export (reports)
- [ ] Loyalty points automation
- [ ] Online reservations portal
- [ ] Multi-language (i18n)
- [ ] ML forecasting (replace heuristic)
- [ ] Offline sync (Hive queue)

## Phase 7 – Production Hardening

- [ ] Load testing (k6/Artillery)
- [ ] Security audit
- [ ] Redis socket adapter
- [ ] E2E tests (Playwright + integration)
- [ ] App Store / Play Store release

## Development Commands Reference

```bash
# Backend
cd apps/backend && npm run dev

# Admin
cd apps/admin && npm run dev

# Mobile
cd apps/mobile && flutter run

# Full stack
docker compose up -d
```
