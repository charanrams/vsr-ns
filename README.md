# VSR Marketplace — Shop · Eat · Live Better

| Folder | What | Stack |
|---|---|---|
| `backend/` | REST API `/api/v1` | Node 22 · Express · TypeScript · MongoDB (Mongoose) · JWT · Nodemailer · Razorpay · Cloudinary |
| `frontend/` | Admin web portal (staff only, role-based) | React 18 · TypeScript · Vite · Tailwind v4 · TanStack Query · Recharts |
| `mobile/` | Customer app (customers only) | Flutter · Riverpod · go_router |
| `docs/` | PRD + reference screens | |

## Run it

```bash
# 1. API (no MongoDB needed for dev: uses an in-memory DB and auto-seeds on start)
cd backend && cp .env.example .env   # leave MONGO_URI empty for in-memory
npm install && npm run dev            # http://localhost:5050/api/v1

# 2. Admin portal
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api → :5050)

# 3. Customer app — talks to http://localhost:5050 on every target
cd mobile && flutter pub get
#   Android (emulator or USB device): forward the device's localhost to this computer, then run
powershell -ExecutionPolicy Bypass -File tool\adb_reverse.ps1    # or: sh tool/adb_reverse.sh
flutter run
#   …or both in one step:  powershell -ExecutionPolicy Bypass -File tool\dev.ps1
#   iOS simulator: just `flutter run` (localhost already reaches the host)
#   Re-run adb_reverse after reconnecting the device or restarting the emulator.
```

For a persistent database set `MONGO_URI` and run `npm run seed` once.

## Role-based access (email → role → landing page)

Password for all staff seeds: `Admin@123`

| Email | Role | Lands on | Can access |
|---|---|---|---|
| superadmin@vsr.in | Super Admin | /dashboard | Everything, incl. staff & audit log |
| orders@vsr.in | Order Manager | /orders | Orders, customers, delivery, notifications |
| catalogue@vsr.in | Catalogue Manager | /products | Products, categories, homemade, banners & offers |
| inventory@vsr.in | Inventory Manager | /inventory | Inventory, products (read) |
| finance@vsr.in | Finance Manager | /payments | Payments, refunds, reports, orders |
| support@vsr.in | Support Agent | /support | Tickets/returns, customers, orders |

- The sidebar only shows permitted pages. Opening a URL you aren't allowed sends you back to your own landing page.
- The **server enforces** the same permission map (`backend/src/utils/roles.ts`), so hiding pages in the UI is not the only protection.
- **Customers** (e.g. `priya@gmail.com` / `Customer@123`) are refused by the admin portal and told to use the app. Staff are refused by the mobile app.
- A Super Admin can create staff and change roles under **Settings**.

## Key business rules implemented
- Order lifecycle `placed → confirmed → picking → packed → assigned → out_for_delivery → delivered`, plus rejected/cancelled/returned. Transitions are server-validated and recorded with actor, time and reason.
- **Accept** atomically reserves stock in a Mongo transaction (no overselling) and requires verified payment or COD. **Reject** requires a reason and creates a refund task if the order was paid.
- Delivery uses a single-use, time-limited, attempt-limited **OTP**. The customer sees the code in the app and the admin enters it.
- Server-side pricing and coupon validation; order placement is idempotent via an `Idempotency-Key` header.
- Inventory: available = onHand − reserved. Every adjustment is logged with a reason and actor.
- Auth: bcrypt passwords, short-lived JWTs plus rotating hashed refresh tokens, rate-limited OTPs with no account enumeration, and password reset by OTP (no links).
- Razorpay order creation, signature verification and an idempotent webhook. Cloudinary uploads go through the backend so secrets stay server-side.

## Dev conveniences (disabled when NODE_ENV=production)
- Without SMTP, OTP emails are printed to the API console and returned as `devOtp`. The app shows them in a "Development build" banner.
- Without Razorpay keys, only Cash on Delivery is offered.
- Without Cloudinary, the admin can paste image URLs instead.
