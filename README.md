# TechSan Restaurant ERP

Enterprise-grade restaurant management ecosystem: Admin Panel, Waiter/Kitchen/Cashier apps, QR ordering, inventory, payroll, and analytics.

## Monorepo Structure

```
techsan_restaurant/
├── apps/
│   ├── backend/          # Node.js + Express + MongoDB API
│   ├── admin/            # Next.js Admin Panel
│   └── mobile/           # Flutter (Waiter, KDS, Cashier)
├── docker-compose.yml
├── nginx/
├── docs/
└── postman/
```

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB 7+
- Flutter 3.16+ (for mobile)
- Docker (optional)

### 1. Environment

```bash
cp .env.example .env
# Edit JWT secrets, MongoDB URI, etc.
```

### 2. Backend API

```bash
cd apps/backend
npm install
npm run seed    # Creates demo data
npm run dev     # http://localhost:4000
```

Swagger: http://localhost:4000/api/docs

**Demo credentials (after seed):**

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Admin   | admin@techsan.com   | Admin@123   |
| Waiter  | waiter@techsan.com  | Waiter@123  |
| Kitchen | kitchen@techsan.com | Kitchen@123 |
| Cashier | cashier@techsan.com | Cashier@123 |

### 3. Admin Panel

```bash
cd apps/admin
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev     # http://localhost:3000
```

### 4. Flutter Mobile

```bash
cd apps/mobile
flutter pub get
flutter run
```

### 5. Docker (full stack)

```bash
docker compose up -d
```

## Documentation

- [Architecture & API Catalog](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Postman Collection](postman/TechSan-Restaurant-API.postman_collection.json)

## Features

- JWT + Refresh token auth with RBAC
- Real-time orders via Socket.IO
- QR table ordering
- Kitchen Display System (KDS)
- Cashier & Razorpay payments
- Inventory auto-deduction
- Employee attendance & payroll
- Reports & AI sales forecast
- Multi-branch support
- Docker + CI/CD ready

## License

Proprietary – TechSan Restaurant Systems
