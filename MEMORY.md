# Project Memory

## 1. Project Snapshot
- Product: VSR multi-category marketplace (spec: `docs/prd.md`; visual refs: `docs/admin_screens/`, `docs/customer_mobile_app_screens/`)
- backend/: Node 22 + Express 4 + TypeScript + Mongoose 8, zod validation, npm, `tsx` dev
- frontend/: ONE app, two areas: customer storefront + public/marketing pages at `/` (src/shop/*, own session `vsr.shop.session`, own axios `shopApi`, customer login portal) and staff admin under `/admin/*` (old admin URLs redirect). React 18 + TS + Vite 6 + Tailwind 4.1 (`@tailwindcss/vite`), TanStack Query, Recharts, lucide-react, sonner. Admin/staff only.
- mobile/: Flutter 3.47, Riverpod 3, go_router 18, http, flutter_secure_storage, razorpay_flutter. Customers only.
- Auth: JWT access (15m) + opaque rotating refresh tokens (sha256 stored in `Session`)
- No git repo yet.

## 2. Architecture
- API base `/api/v1`: `/auth`, `/store` (public catalogue) + `/store/me/*` (customer), `/admin/*` (staff, `authenticate + requireStaff + can(perm)`), `/webhooks/payments` (raw body).
- Roles/permissions single source: `backend/src/utils/roles.ts`; mirrored in `frontend/src/lib/access.ts` (NAV + `homeFor(roles)` landing pages).
- Login `portal: 'admin'|'customer'` → server rejects wrong audience.
- Order state machine + stock reserve/release/fulfil (Mongo transactions): `backend/src/utils/orders.ts`. Admin transitions: `routes/admin/orders.ts`.
- Dev DB: empty `MONGO_URI` → mongodb-memory-server replset (transactions need a replset), auto-seeded by `src/seed.ts`.
- Frontend: shared UI kit `src/components/ui.tsx`, charts `components/charts.tsx`, shell `components/AdminLayout.tsx`, one file per page in `src/pages/`.
- Mobile: `lib/core` (api, models, theme, format), `lib/state/providers.dart` (session, cart, data providers), `lib/widgets/common.dart`, `lib/features/*`, `lib/router.dart` (StatefulShellRoute bottom nav).

- Realtime sync (2026-10-23): `backend/src/realtime.ts` = one Mongo change stream (needs replset; Atlas/dev memory replset OK) → Socket.IO `change {coll, op, id}` (no data) to rooms `public` / `user:<id>` / `customers` / `staff`; clients refetch via REST. Web: `frontend/src/lib/realtime.ts` (collection → TanStack query-key prefixes, started in main.tsx; Vite proxies `/socket.io` with ws). Mobile: `lib/state/realtime.dart` (collection → providers, watched in main.dart). New screens/queries must be added to those two maps. Spec: `docs/realtime-sync.md`.

- Home screen is admin-controlled (Admin → Marketing → Home Screen, `/admin/home-screen`, perm marketing): `backend/src/utils/homeLayout.ts` (HomeLayout singleton: sections order/title/enabled/autoFill/pinned productIds + categoryIds incl. subcategories). `/store/home` returns `sections` + `recommended`; `/me/recommendations` = pinned first, then past-order matches. Web + mobile Home render rows from `sections`. Category rows (key 'category' + categoryId, products inline as `items`) come from the Categories form switch "Show on Home screen" (`setCategoryHomeRow`): top-level category → listed in Shop by Category (`categoryIds`; empty = all top-level, switches default on); subcategory → own product row after Best Sellers and also editable in the Home Screen editor; same layout doc.
- Mobile location: GPS off → in-app system dialog via `location` package `requestService()` (no Settings trip); only permanently-denied permission still needs app Settings (Android rule).

- Notify Me (back in stock): `backend/src/utils/restock.ts` (StockAlert model, one open request per customer+product; `checkRestock` runs from the realtime change stream on every products write → in-app Notification with `link: /product/<id>` + email, each alert claimed atomically so it fires once). Customer API `GET/POST/DELETE /store/me/stock-alerts[/:productId]` (POST only when out of stock). Web `NotifyMe` (shop/ui.tsx), app `NotifyMeButton` (widgets/common.dart) on cards + product page. Product cards show real ratings only ("New" when none).

## 3. Design System
- Tokens per PRD §5.1: forest green `#0B3D2E/#064E3B`, orange accent `#F58220`, cream bg `#FBF7EE`, ink `#202923`, line `#EBE5DA`. Web tokens in `frontend/src/index.css` @theme; Flutter tokens in `mobile/lib/core/theme.dart` (with dark theme).
- Mobile layout system (2026-10-23 refinement pass): `VsrSpace` 4-pt scale + roles (gutter 16, sectionTop 28/sectionBottom 12, group 12, row 8, navClearance 120) and `VsrRadius` (sm 10, md 14, lg 18) in `core/theme.dart`; start-aligned app bar titles; grouped lists use `TileGroup` + `NavTile` (`widgets/common.dart`), never hand-built Card+Divider stacks; `MessageView` is safe inside lists (scrolls only when height is bounded). Per-screen checklist: `docs/mobile-screen-checklist.md`.
- Font (web): Plus Jakarta Sans. Logo assets: `frontend/public/logo.jpg`, `logo-mark.png`; mobile `assets/images/`. App icons installed from root `AppIcons.zip`.

## 4. Engineering Decisions
- Mobile theming: `themeModeProvider` (System default; Light/Dark picker in Profile → More, saved in SharedPreferences `vsr.themeMode`), EXCEPT splash, onboarding and the whole login/sign-up flow, which are wrapped with `alwaysLight()` in `router.dart`. Adaptive colours come from the `VsrPalette` ThemeExtension via `context.vsr.<token>` (bg, surface, line, lineSoft, ink, muted, brandText, brand50/100, accent50, status fg/bg). `VsrColors` = fixed brand colours (filled buttons/badges with white text). New UI in app screens must use `context.vsr`, not `VsrColors.cream/ink/muted/...`. Date: 2026-10-22
- Stock is reserved at **admin accept**, not at order placement (PRD §7.3). Date: 2026-10-21
- Product deletion = archive (keeps order snapshots). Category delete blocked if products/subcats exist.
- Delivery OTP plain value stored `select:false` and only returned to the owning customer; admin verifies it (no delivery-partner app yet).
- Dev-only `devOtp` in auth responses when `NODE_ENV!=production`.

## 5. Completed Major Work (2026-10-21)
- Integrations live in backend/.env: MongoDB Atlas (db `vsr`, auto-seeded when empty), Cloudinary (`charan12`), Razorpay test keys. Verified upload + Razorpay order creation.
- Admin shell: hamburger collapses sidebar on desktop (persisted in localStorage `vsr.sidebar`), content goes full width; sidebar promo card removed; scrollbars hidden globally (index.css).
- Categories accordion: single-open, animated (grid-rows), scrolls opened section into view; closed panels are inert.
- Backend complete: auth (email+password, phone/email OTP, signup verify, reset), catalogue, cart, checkout, orders, payments/refunds, inventory, customers, delivery partners, kitchens, banners/coupons, notifications, support, reports, dashboard, audit, staff users, seeds.
- Admin portal: all sidebar pages matching reference screens; role redirect after login.
- Customer app: onboarding → auth → home/categories/search/product → cart/coupon → address → payment (COD/Razorpay) → success → orders/tracking/delivery code/cancel/reorder/rate → profile/notifications/help/wishlist/offers/more.

- Charts are all backend-driven with range params: dashboard `trendRange/statusRange/catRange/bestRange/earnRange` (`seriesFor`: daily ≤31 days, monthly beyond), inventory overview `months` (month-end stock rebuilt from InventoryMovement ledger), customers insights `months`, payments/support `trendDays`, reports `range`. UI uses `RangeSelect` (components/ui.tsx).

- Mobile spec (customer app, 210 screens) being added section by section, additive only. Done: 1.1 launch/gates (`state/app_gate.dart`, `features/system/`), login per user's reference images (`features/auth/login_flow.dart`: entry → password/OTP → success; reset OTP dialog → new password; keep-me-logged-in = memory-only tokens), splash/onboarding (assets cropped from user refs, auto-scroll 4s), 1.3 location (`features/location/`: geolocator + platform geocoder + flutter_map OSM, serviceability via `/store/serviceability`, SERVICE_PINCODES env), 1.4 discovery (`features/discovery/`: search v2 w/ recent/suggestions/filter/sort, deals, campaign, recommended `/store/me/recommendations`, recently viewed local, notification detail). Spec 1.2 was replaced by the user's own login references. Skipped by design: items marked "if supported/enabled" (barcode search, live map, notify-me).

- Pack sizes (variants) are first-class: variant subdocs carry price/mrp/stock/reserved; cart/order lines carry `variant` + `variantName`; products with sizes ALWAYS sell from variant stock (default/first size when none chosen); reserve/release/fulfil per size inside the Mongo transaction (`utils/orders.ts`, `variantFor`, `lineKey`). Admin product PUT preserves variant `_id`/`reserved` by SKU and blocks removing a size with reservations. Admin order details read stock by `product:variant`. Known gap: admin Inventory page still shows product-level stock for sized products (variant stock is edited in the product form).
- 1.5 done: product extras (`features/catalog/product_extras.dart`: gallery/zoom, reviews screen, write/edit review via `/store/me/products/:id/review` gated on a delivered order, success screen, unavailable view), size picker, wishlist snackbars.

## 6. Current Work
- Nothing in progress. Verified: backend `tsc` clean + E2E order lifecycle via curl; frontend `tsc -b` + `vite build` clean, all pages screenshot-checked; `flutter analyze` clean, `flutter test` green. Mobile not yet run on a device/emulator.

## 7. Known Issues
- A few seeded Unsplash image IDs don't match the product (UI falls back to a placeholder).
- Location permission / map-pin screens from the mobile reference are not implemented (no maps provider chosen — PRD §21 open decision).
- Delivery partner mobile app not built (out of the requested scope).

## 8. Important Constraints
- Config: website reads the backend address only from `frontend/src/lib/config.ts` (`API_BASE`/`API_ORIGIN` ← `VITE_API_URL` in `frontend/.env`; empty = same-origin via Vite proxy, whose target/port also come from .env). Backend CORS policy lives in `backend/src/config/cors.ts` (CORS_ORIGINS list + `*.domain` wildcards, any localhost in dev, no-Origin clients allowed, 403 `cors_rejected` otherwise); Socket.IO uses the same `isAllowedOrigin`. Add production website domains to CORS_ORIGINS.
- Dev API runs on port 5050 (5000 is used by another local app). Mobile default API_URL is http://localhost:5050/api/v1; Android needs `adb reverse tcp:5050 tcp:5050` via `mobile/tool/adb_reverse.ps1` (or `tool/dev.ps1` = reverse + flutter run). Re-run after reconnecting a device.
- Roles: ONE web login at `/login` (`/admin/login` redirects). It signs in without a portal hint and routes by role in `shop/auth.tsx` `accept()`: staff → admin session (`vsr.session`) + `homeFor(roles)`; customers → shop session; delivery partners refused (no web portal). Sessions stay separate per area. Account pages guarded by `RequireCustomer`.
- Legal/policy text single source: `frontend/src/shop/legal.ts` → mobile `lib/core/legal.dart` generated by `mobile/tool/gen_legal.mts` (rerun after edits). Registered name/address/GSTIN still blank in LEGAL_ENTITY; needs legal review before launch.
- Secrets only in backend `.env`; never in clients.

- Mobile shell (`router.dart` `_Shell`): back on a non-Home tab goes to Home (PopScope); scrolling down hides the nav bar and shows the compact cart bar in its place. Signed-in launch asks location + notification permission once per run via in-app dialogs only (`state/permissions.dart`, permission_handler). `LoadingView` is a pulsing skeleton (used by `AsyncBody`).

## 11. Do Not Repeat
- permission_handler is pinned to 12.0.1: 13.x pulls permission_handler_android 14.x (compileSdk 37), which fails to build here ("Failed to find target android-37").
- Don't play the splash with `video_player`: its texture deadlocked the UI thread with Impeller/Vulkan on an iQOO I2501 (ANR "Input dispatching timed out"). Splash is an animated WebP (`assets/images/splash.webp`, 540×960, 20 fps, 6 s) shown via `Image`, with spinner + Gemini ✦ removed via ffmpeg `delogo`. Regenerate from the source MP4 with the same delogo boxes if the clip changes.
- Don't read `state` inside a Riverpod `Notifier.build()` (directly or via a method it calls) — defer with `Future.microtask` (GateNotifier bug caused a blank screen).
- Don't `ref.invalidate` a provider that watches the notifier doing the invalidating (logout bug).
- Tailwind 4.0.0 vite plugin crashes on build ("Cannot convert undefined or null to object") → use 4.1.x.
- `useEffect(() => window.scrollTo(...))` crashes in new Chrome (scrollTo returns a Promise) → wrap in braces.
- A `SliverPersistentHeaderDelegate` child must fill `maxExtent` (give it `height: maxExtent`); otherwise layout throws every frame → blank Home + ANR on device (fixed in Home `_PinnedSearch`, 2026-10-23).
- Guests: Orders/Profile/More tabs are open to guests (router `_guestAllowed`) and show `GuestPrompt` / `requireLogin` instead of redirecting to /login; never `context.pop()` without `canPop()` on screens reachable by redirect.
- Git Bash mangles `/paths` passed to node scripts → use `MSYS_NO_PATHCONV=1`.

## 12. Last Updated
2026-10-23
