# VSR Nature Market — Comprehensive System Architecture & Memory

> **Single Source of Truth** for the entire VSR platform codebase:
> - **Backend**: Node 22 + Express 4 + TypeScript + Mongoose 8 + Socket.IO + FCM + Razorpay + Cloudinary
> - **Frontend Web**: React 18 + Vite 6 + Tailwind 4.1 + TanStack Query (Storefront at `/` + Staff Admin at `/admin/*`)
> - **Mobile Customer App**: Flutter 3.47 + Riverpod 3 + GoRouter 18 + Razorpay + OSM/flutter_map

---

## 1. Project Directory & Architecture Map

```
vsr/
├── backend/
│   ├── src/
│   │   ├── config/             # CORS policy, environment variables, feature flags
│   │   ├── middleware/         # Auth (JWT verification, role guards, request IDs)
│   │   ├── models/             # Mongoose schemas (User, Catalog, Order, Ops)
│   │   ├── routes/             # REST API routes (auth, store, devices, admin/*)
│   │   ├── utils/              # Order state machine, realtime change stream, FCM, restock
│   │   ├── app.ts              # Express application factory & middleware setup
│   │   ├── server.ts           # HTTP server, Socket.IO binding, port listener (5050)
│   │   ├── seed.ts             # Comprehensive database seed script
│   │   └── realtime.ts         # Mongo change stream to Socket.IO room broadcaster
├── frontend/
│   ├── src/
│   │   ├── components/         # AdminLayout, Admin UI kit, charts, widgets
│   │   ├── lib/                # Admin auth, API client, access matrix, permissions
│   │   ├── pages/              # Staff Admin pages (20 dedicated modules)
│   │   ├── shop/               # Customer Storefront (Layout, Auth, APIs, 9 modules)
│   │   ├── App.tsx             # Root router with dual storefront and admin sub-apps
│   │   └── index.css           # Tailwind 4.1 CSS tokens, custom scrollbars, global styles
├── mobile/
│   ├── lib/
│   │   ├── core/               # Theme tokens (VsrPalette, VsrSpace, VsrRadius), models, API, legal
│   │   ├── state/              # Riverpod providers (cart, session, gate, realtime, push)
│   │   ├── widgets/            # ProductTile, ProductRail, BottomCta, QuantityStepper, etc.
│   │   ├── features/           # 9 domain modules (system, onboarding, auth, location,
│   │   │                       #   catalog, discovery, checkout, orders, profile)
│   │   ├── router.dart         # GoRouter shell route, bottom nav, auth guards, pop scopes
│   │   └── main.dart           # Flutter entry point, system overlays, gate init
└── docs/                       # PRD, screen references, realtime sync documentation
```

---

## 2. Backend Architecture & Data Layer

### 2.1 Core Infrastructure & Server Entry
- **Server Entry (`server.ts` & `app.ts`)**:
  - Express 4 server running on port `5050` (`NODE_ENV=development`).
  - Security & performance: `helmet()`, `cors(corsOptions)`, `compression()`, `morgan()`.
  - CORS policy in `config/cors.ts`: Allows `localhost`, specific web origins, wildcard subdomains, and no-origin mobile clients.
  - Raw body webhook route: `/api/v1/webhooks/payments` processes Razorpay signatures and captured/failed payment events before `express.json()` parsing.
- **Realtime Layer (`realtime.ts`)**:
  - Subscribes to MongoDB change streams (`User`, `Category`, `Product`, `Order`, `Review`, `Notification`, `Coupon`, `Banner`, `Kitchen`, `HomeLayout`, etc.).
  - Emits lightweight `{ coll, op, id }` events via Socket.IO to specific rooms:
    - `public`: Catalog updates, banners, categories, home layout.
    - `user:<id>`: Order status changes, personal notifications, address/profile updates.
    - `customers`: Broadcast notifications, new deals.
    - `staff`: Order management alerts, inventory alerts, support tickets.
- **Push Notification Engine (`utils/push.ts`)**:
  - FCM v1 integration with `firebase-admin`.
  - `DeviceToken` collection maintains guest & user FCM device tokens.
  - Automatic push delivery triggered via Mongoose post-save hooks on `Notification`.
  - Android notification channel `vsr_alerts` configured with high importance and lockscreen visibility.

### 2.2 Mongoose Schemas & Data Models
1. **User Model (`models/User.ts`)**:
   - `User`: Email, phone, passwordHash, name, avatar, roles (`customer`, `super_admin`, `admin`, `inventory_manager`, `order_manager`, `kitchen_staff`, `delivery_staff`, `marketing_lead`, `support_agent`), addresses (subdoc array with geo coordinates, default flag, receiver info), status (`active`, `blocked`).
   - `Session`: Refresh token hash, user reference, expiresAt, userAgent, ipAddress.
2. **Catalog Model (`models/Catalog.ts`)**:
   - `Category`: Name, slug, image, parent category reference, displayOrder, isActive, showOnHome.
   - `Product`: Name, slug, category, subcategory, brand, description, images (array), tags, status (`active`, `draft`, `archived`), badge (`bestseller`, `new`, `organic`, `fresh`), nutrition/ingredients, ratingAverage, ratingCount, stock, reservedStock, minOrderQty, maxOrderQty, hasVariants, variants (subdocs with name, sku, price, mrp, stock, reservedStock, isDefault).
   - `Review`: Product ID, customer ID, order ID, rating (1-5), comment, images, status (`pending`, `approved`, `rejected`).
3. **Order & Payment Models (`models/Order.ts`)**:
   - `Order`: OrderNumber (`VSR-YYYYMMDD-XXXX`), customer ID, items (product snapshot, variant ID, variantName, quantity, price, mrp, subtotal), deliveryAddress snapshot, billSummary (itemsTotal, discountTotal, deliveryFee, taxes, grandTotal), status (`placed`, `confirmed`, `picking`, `packed`, `assigned`, `out_for_delivery`, `delivered`, `cancelled`), cancelReason, deliveryPartner ID, deliveryOtp (stored select:false), paymentStatus (`pending`, `paid`, `failed`, `refunded`), paymentMethod (`cod`, `razorpay`, `wallet`), timeline array.
   - `Payment`: Order ID, amount, provider (`razorpay`, `cod`), providerOrderId, providerPaymentId, status, logs.
   - `Cart`: Customer ID, items (product ID, variant ID, quantity), appliedCoupon, updatedAt.
   - `Refund`: Order ID, payment ID, amount, reason, status (`processed`, `failed`), providerRefundId.
4. **Operations Models (`models/Ops.ts`)**:
   - `Notification`: Recipient (or `all_customers` / `all_staff`), title, message, type, link, order ID, readBy, hiddenBy.
   - `StockAlert`: Product ID, customer ID, notified, notifiedAt (atomic claim restock trigger).
   - `Coupon`: Code, title, discountType (`percent`, `flat`), discountValue, minOrderValue, maxDiscount, validFrom, validUntil, usageLimit, usageCount, isActive.
   - `Banner`: Title, subtitle, image, linkType (`category`, `product`, `url`), linkValue, displayOrder, isActive.
   - `Kitchen`: Name, chefName, phone, specialty, address, bannerImage, rating, status (`active`, `inactive`).
   - `SupportTicket`: Customer ID, order ID, subject, category, message, status (`open`, `in_progress`, `resolved`), responses.
   - `DeliveryPartner`: Name, phone, vehicleType, vehicleNumber, status (`active`, `on_delivery`, `inactive`), currentCoordinates.
   - `HomeLayout`: Pinned product IDs, section orders, category rows configuration.
   - `AuditLog`: Staff user ID, action, resource, resourceId, details, ipAddress.

### 2.3 API Endpoints Breakdown

#### Public & Customer Store APIs (`/api/v1/store`)
| Endpoint | Method | Description |
|---|---|---|
| `/config` | `GET` | Platform settings, razorpay key, version gates, maintenance status |
| `/serviceability` | `GET` | Check pincode serviceability against `SERVICE_PINCODES` |
| `/home` | `GET` | Complete home layout (banners, sections, categories, recommendations) |
| `/categories` | `GET` | Category tree (parents and children) |
| `/products` | `GET` | Filtered product catalog (search, category, price, tags, pagination) |
| `/products/:id` | `GET` | Single product details, variant breakdown, stock availability |
| `/products/:id/reviews` | `GET` | Approved reviews, rating distribution |
| `/deals` | `GET` | Flash sales, discount offers, campaign banners |
| `/search/suggestions` | `GET` | Auto-complete suggestions for product search |
| `/me/cart` | `GET/POST/PUT`| Fetch active cart, add/update quantity, sync cart |
| `/me/cart/coupon` | `POST/DELETE`| Apply coupon code, remove coupon code |
| `/me/wishlist` | `GET/POST/DEL`| Customer wishlist items, toggle products |
| `/me/addresses` | `GET/POST/PUT/DEL`| Customer delivery address book |
| `/me/orders` | `GET/POST` | Order history, initiate new order checkout |
| `/me/orders/:id` | `GET/POST` | Detailed order timeline, cancel order request |
| `/me/orders/:id/invoice`| `GET` | Download/render printable PDF invoice data |
| `/me/products/:id/review`|`POST/PUT` | Submit or update review for a delivered product |
| `/me/stock-alerts` | `GET/POST/DEL`| Subscribe or unsubscribe to back-in-stock alerts |
| `/me/notifications` | `GET/PUT/DEL` | In-app notification center, mark read, delete/clear |
| `/me/tickets` | `GET/POST` | Customer support ticket submission and history |

#### Staff Admin APIs (`/api/v1/admin`)
| Endpoint | Method | Required Permission | Description |
|---|---|---|---|
| `/orders` | `GET` | `orders` | Filtered order management list |
| `/orders/:id` | `GET` | `orders` | Full order lifecycle details and audit trail |
| `/orders/:id/transition` | `POST` | `orders` | State transition (`accept`, `pack`, `dispatch`, `deliver`) |
| `/orders/:id/assign` | `POST` | `orders` | Assign order to delivery partner |
| `/orders/:id/verify-otp` | `POST` | `orders` | Verify customer OTP to complete delivery |
| `/catalog/products` | `GET/POST/PUT/DEL` | `products` | Product management and variant stock editor |
| `/catalog/categories` | `GET/POST/PUT/DEL` | `categories` | Category hierarchy, banner imagery, home row switch |
| `/catalog/reviews` | `GET/PUT` | `products` | Review moderation (approve / reject) |
| `/people/customers` | `GET/PUT` | `customers` | Customer directory, block/unblock, address inspection |
| `/people/delivery-partners` | `GET/POST/PUT` | `delivery` | Onboard delivery personnel, track status |
| `/people/users` | `GET/POST/PUT` | `users` | Staff administration and RBAC assignment |
| `/business/inventory` | `GET/POST` | `inventory` | Stock adjustments, low stock alerts, audit movement ledger |
| `/business/coupons` | `GET/POST/PUT/DEL` | `marketing` | Promo codes, minimum orders, usage caps |
| `/business/banners` | `GET/POST/PUT/DEL` | `marketing` | Promotional hero banners and campaign graphics |
| `/business/home-screen` | `GET/PUT` | `marketing` | Visual drag-and-drop home screen section customizer |
| `/business/payments` | `GET` | `payments` | Transactions ledger, Razorpay reconciliations, refund trigger |
| `/business/reports` | `GET` | `reports` | Revenue, order frequency, cohort, top selling analytics |
| `/business/support` | `GET/PUT` | `support` | Ticket resolution, customer response threads |
| `/business/settings` | `GET/PUT` | `settings` | Store timings, free delivery threshold, tax rates |

---

## 3. Frontend Web Application Breakdown

The web application runs from a single unified Vite/React build (`frontend/src/App.tsx`). It smartly segments into two distinct user experiences:
1. **Customer Storefront** (Root routes `/` using `ShopLayout` and `shopApi` session `vsr.shop.session`).
2. **Staff Admin Portal** (Protected routes `/admin/*` using `AdminLayout` and staff session `vsr.session`).

### 3.1 Storefront Modules & Pages (`src/shop/pages/*`)
1. **Home (`Home.tsx` - `/`)**:
   - Hero banner carousel with call-to-actions.
   - Pinned category circular rail with quick filters.
   - Dynamic sections managed by Admin Home Screen Builder:
     - "Best Sellers" rail with `ProductCard` components.
     - "Deals of the Day" with discount chips.
     - Category-specific showcase rows (e.g., Organic Honey, Cold Pressed Oils).
     - "From Local Kitchens" homemade specials.
   - Trust badges (100% Organic, Express Delivery, Secure Payments).
2. **Search & Discovery (`Search.tsx` - `/search`)**:
   - Debounced instant search query input.
   - Multi-facet filters: Category, Price Range, In-Stock only, Organic badge.
   - Sort dropdown: Relevance, Price (Low to High / High to Low), Customer Rating, Newest.
   - Empty state with recommendations when no results match.
3. **Catalog & Collections (`Catalog.tsx`)**:
   - `/categories`: Visual grid of all top-level departments and subcategories.
   - `/category/:id`: Category landing page with subcategory filter pills.
   - `/deals`: Aggregated discounted items and active promotional campaigns.
   - `/campaign/:index`: Specific marketing campaign landing with curated products.
   - `/recommended`: Personalized recommendations derived from past orders.
   - `/recently-viewed`: Client-side persisted recently viewed product grid.
4. **Product Details (`Product.tsx` - `/product/:id`)**:
   - High-resolution gallery carousel with thumbnail navigation and full-screen lightbox zoom.
   - Dynamic variant pack-size selector (e.g., 250g, 500g, 1kg) updating price, MRP, and stock status.
   - Delivery pin code serviceability validator.
   - Real-time stock status (In Stock, Low Stock, or Out of Stock with "Notify Me" trigger).
   - Rich product highlights, nutritional information, origin, storage instructions.
   - Customer ratings breakdown, review list, and "Write a Review" modal gated on verified purchase.
5. **Checkout & Cart (`Checkout.tsx`)**:
   - `/cart`: Slide-over drawer and dedicated page with quantity steppers, item removal, free delivery progress bar.
   - `/checkout`: Address selection/creation, contact information, delivery slot selection.
   - `/checkout/payment`: Payment method choice (Razorpay checkout modal for UPI/Cards/Netbanking or Cash on Delivery).
   - `/order-placed/:id`: Order confirmation page with confetti, order summary, timeline link, and invoice download.
6. **Customer Account & Orders (`Orders.tsx` & `Account.tsx`)**:
   - `/account`: Customer dashboard displaying profile stats, wallet balance, active orders.
   - `/account/orders`: Filterable order history (Active, Completed, Cancelled).
   - `/account/orders/:id`: Step-by-step progress tracker, delivery partner contact, items breakdown, cancel button, and invoice viewer.
   - `/account/orders/:id/rate`: Dedicated feedback flow for completed orders.
   - `/account/addresses`: Delivery address book CRUD with map coordinate picker.
   - `/account/wishlist`: Saved products list with one-click "Move to Cart".
   - `/account/coupons`: Available coupons list with minimum spend criteria and direct "Apply" action.
   - `/account/notifications`: In-app notification center with read/unread indicators and swipe-to-delete.
   - `/account/help`: FAQ accordion and customer support ticket submission.
7. **Customer Auth Flow (`Auth.tsx`)**:
   - Dedicated minimal, distraction-free authentication container (`LoginPage`, `PasswordPage`, `OtpPage`, `SignUpPage`, `ForgotPasswordPage`, `NewPasswordPage`, `PasswordUpdatedPage`).
   - Seamless role routing: If an administrative staff member signs in at `/login`, they are immediately redirected to `/admin/dashboard`.
8. **Legal & Information (`Info.tsx`)**:
   - Dynamic policy pages (`/about`, `/contact`, `/faq`, `/terms`, `/privacy`, `/refund-policy`, `/delivery-policy`).

### 3.2 Staff Admin Modules (`src/pages/*`)
1. **Dashboard (`Dashboard.tsx` - `/admin/dashboard`)**:
   - Realtime metric cards: Today's Revenue, Active Orders, Out of Stock Items, Pending Tickets.
   - Interactive charts with date-range filters (`seriesFor` daily/monthly): Revenue Trends, Order Status distribution, Top Selling Categories.
2. **Orders (`Orders.tsx` & `OrderDetails.tsx` - `/admin/orders`)**:
   - Real-time tabular order feed with status chips, payment indicators, delivery partner badges.
   - Detail view with order items, variant specifications, stock deduction logs.
   - Step-by-step state transition triggers: Accept Order -> Mark Picking -> Mark Packed -> Dispatch -> Verify Delivery OTP.
3. **Products & Catalog (`Products.tsx` & `ProductForm.tsx` - `/admin/products`)**:
   - Product catalog with search, category filtering, stock health badges.
   - Complete product editor: Name, slug, descriptions, multi-image upload via Cloudinary, tags, pack-size variant table with SKU, price, MRP, and inventory counts.
   - `/admin/products/reviews`: Customer review moderation queue (Approve / Reject).
4. **Categories (`Categories.tsx` - `/admin/categories`)**:
   - Interactive category accordion.
   - Direct switch: "Show on Home Screen" which automatically creates/links a curated row on the storefront home page.
5. **Inventory (`Inventory.tsx` & `InventoryHistory.tsx` - `/admin/inventory`)**:
   - Real-time stock counts across standard and variant products.
   - Quick stock adjustment dialog with reason logging (restock, breakage, correction).
   - Immutable audit trail of every inventory movement.
6. **Customer Management (`Customers.tsx` - `/admin/customers`)**:
   - Customer directory with lifetime spend, order count, join date.
   - Deep inspection drawer: past orders, saved addresses, active tickets, block/unblock account toggle.
7. **Delivery Operations (`DeliveryPartners.tsx` & `DeliveryOperations.tsx`)**:
   - Partner registration, phone number, vehicle details, active/inactive toggle.
   - Active delivery map and assignment panel for out-for-delivery orders.
8. **Homemade Kitchens (`Homemade.tsx` - `/admin/homemade`)**:
   - Local chef and kitchen directory, approval workflow, specialty cuisine configuration.
9. **Visual Home Screen Builder (`HomeScreen.tsx` - `/admin/home-screen`)**:
   - Drag-and-drop reordering of home screen rows.
   - Enable/disable sections (Banners, Best Sellers, Category rows, Custom Rails).
   - Product pin selector allowing staff to pin specific hero products to any section.
10. **Marketing (`Marketing.tsx` - `/admin/marketing`)**:
    - Promotional coupon creation (percentage or flat discount, expiry, usage limits).
    - Hero banner manager with image upload and link target configuration.
11. **Payments & Reconciliations (`Payments.tsx` - `/admin/payments`)**:
    - Payment transaction ledger, Razorpay settlement status, manual refund initiation.
12. **Analytics & Reports (`Reports.tsx` - `/admin/reports`)**:
    - Exportable CSV/Excel reports: Sales reports, customer acquisition, inventory turnover, delivery partner performance.
13. **Customer Support (`Support.tsx` - `/admin/support`)**:
    - Support ticket inbox, priority tags, internal notes, reply thread with customer.
14. **System Notifications (`Notifications.tsx` - `/admin/notifications`)**:
    - Push broadcast composer: Send targeted or store-wide push alerts to customer devices.
15. **Store Settings (`Settings.tsx` - `/admin/settings`)**:
    - Store operational hours, serviceability pin codes, minimum order value, free delivery threshold, tax configuration.

---

## 4. Mobile Customer App (Flutter) Breakdown

### 4.1 Architecture & Navigation Structure
- **Router (`lib/router.dart`)**:
  - `GoRouter` with `StatefulShellRoute.indexedStack` managing the 4-tab bottom navigation:
    1. Index 0: **Categories** (`/categories`)
    2. Index 1: **Home** (`/`) - Root tab
    3. Index 2: **Orders** (`/orders`)
    4. Index 3: **Profile** (`/profile`)
  - **Dynamic Shell (`_Shell`)**:
    - Back button on non-home tabs automatically routes back to Home (`canPop: currentIndex == 1`).
    - Smart scroll detection: Scrolling downward hides the bottom navigation bar and displays the compact `FloatingCartBar` in its place.
    - Floating Cart Bar (`FloatingCartBar`) with active item count and subtotal, with tap-to-expand.
  - **System App Gates (`state/app_gate.dart`)**:
    - Prioritized gate interceptor handling Maintenance Mode, Force Update (minVersion check), Unsupported Version, and Service Outage before allowing user into the app.

### 4.2 Comprehensive Mobile Screen Inventory

#### 1. System & Lifecycle Screens (`features/system/system_screens.dart`)
- **`SplashScreen`**: Plays animated WebP brand logo (`assets/images/splash.webp`) without Impeller Vulkan texture deadlock. Pre-loads session and gate status.
- **`AppLoadingScreen`**: Pulsing skeleton state during initial authorization bootstrap.
- **`MaintenanceScreen`**: Full-screen lockout during server maintenance with custom administrative message.
- **`UpdateRequiredScreen`**: Mandatory blocking update screen redirecting user to App Store / Play Store.
- **`UnsupportedVersionScreen`**: Graceful deprecation screen for legacy operating systems.
- **`ServiceUnavailableScreen`**: Network offline and server reachability failure retry view.

#### 2. Onboarding Flow (`features/onboarding/onboarding_screens.dart`)
- **`OnboardingScreen`**: 3-step carousel highlighting Organic Products, Lightning Delivery, and Artisanal Kitchens. Features 4-second auto-advancing timer, animated dot indicators, "Skip", and "Get Started" triggers.

#### 3. Authentication & Security Flow (`features/auth/login_flow.dart`)
- **`LoginEntryScreen`**: Entry point accepting mobile number or email address with country code prefix, legal consent checkbox, and guest bypass link.
- **`PasswordScreen`**: Secure password input with visibility toggle, forgot password trigger, and OTP alternative switch.
- **`LoginOtpScreen`**: 6-box auto-focusing numeric OTP verification with resend timer and SMS autofill support.
- **`CreatePasswordScreen`**: New password definition with strength meters for account setup or recovery.
- **`PasswordUpdatedScreen`**: Success confirmation before returning to login or dashboard.
- **`SignUpScreen`**: User registration collecting Full Name, Email, Phone Number, and Referral Code.
- **`LoginSuccessScreen`**: Seamless animated transition into the customer dashboard.

#### 4. Location & Delivery Serviceability (`features/location/location_screens.dart`)
- **`ChooseLocationScreen`**: Saved addresses selector with GPS "Use Current Location" button.
- **`LocationPermissionScreen`**: Educational primer explaining why location permission is necessary.
- **`LocationSearchScreen`**: Places autocomplete search bar powered by OpenStreetMap Nominatim.
- **`MapPickScreen`**: Interactive map pin-drop screen using `flutter_map` with draggable marker, reverse geocoding, and address confirmation.
- **`NotServiceableScreen`**: Informative prompt shown when customer's pin code is outside delivery zones.
- **`LocationUnavailableScreen` / `LocationDeniedScreen`**: Directs user to device settings or system dialogs.

#### 5. Catalog & Product Discovery (`features/catalog/` & `features/discovery/`)
- **`HomeScreen` (`catalog_screens.dart`)**:
  - Hero Header with active delivery address picker and notification bell.
  - Pinned search bar with instant filter triggers.
  - Admin promotional banner carousel (`_BannerCarousel`).
  - Circular category rail (`_CategoryCell`).
  - Curated product rails (`ProductRail`): "Best Sellers", "Deals of the Day", "Local Kitchens".
- **`CategoriesScreen` (`catalog_screens.dart`)**:
  - Full department visual browser with high-res category imagery, item count badges, and subcategory navigation.
- **`ProductListScreen` (`catalog_screens.dart`)**:
  - Paginated product grid or list view with sorting sheet (Price, Rating, Newest) and subcategory filters.
- **`ProductDetailScreen` (`catalog_screens.dart`)**:
  - Multi-image zoomable carousel with full-screen `GalleryScreen`.
  - Pack-size variant selector with real-time price, discount percentages, and stock availability.
  - "Notify Me" button (`NotifyMeButton`) for out-of-stock items.
  - Product specs: Highlights, Nutritional Facts, Storage, Origin.
  - Customer review summary with direct navigation to `ReviewsScreen` and `WriteReviewScreen`.
  - Sticky bottom action bar with `AddToCartButton` and direct checkout.
- **`SearchV2Screen` (`discovery_screens.dart`)**:
  - Live debounced search with recent search history chips and clear button.
  - Category, price range, and in-stock bottom sheet filters (`_FilterSheet`).
- **`DealsScreen` (`discovery_screens.dart`)**:
  - Flash discount cards, coupon banners, and limited-time offer badges.
- **`ProductCollectionScreen` (`discovery_screens.dart`)**:
  - Dedicated grid view for "Recommended For You" or "Recently Viewed" items.

#### 6. Cart & Checkout Flow (`features/checkout/checkout_screens.dart`)
- **`CartScreen`**:
  - `_FreeDeliveryBar`: Visual progress indicator calculating remaining amount to qualify for free shipping.
  - Cart item cards (`_CartItemCard`) featuring dynamic unit calculation (`_cartItemUnit` dynamically displays "7 pcs · In stock").
  - `_CouponCard` and bottom sheet coupon selector (`_CouponSheet`) with instant discount validation.
  - `BillCard`: Subtotal, delivery fee, coupon savings, and grand total.
  - `BottomCta`: 48px full-width standardized checkout button.
- **`AddressesScreen` & `AddressFormScreen`**:
  - Manage saved delivery addresses (Home, Work, Other) with default address selector.
  - Complete form with street, apartment, landmark, pin code, contact name, and phone.
- **`PaymentScreen`**:
  - Payment method choices: Online Payment (UPI, Credit/Debit Cards, Netbanking via Razorpay Flutter SDK) or Cash on Delivery (COD).
  - Price summary and delivery address preview before final placement.
- **`OrderSuccessScreen`**:
  - Celebration confirmation with order number, estimated delivery window, "Track Order" button, and "Continue Shopping".

#### 7. Orders & Tracking (`features/orders/order_screens.dart`)
- **`OrdersScreen`**:
  - Segmented tabs: Active Orders, Past Orders, Cancelled Orders.
  - Order summary cards with thumbnail previews, status chip, total amount, and quick reorder button.
- **`OrderDetailScreen`**:
  - Visual order timeline (`_Stop`): Placed -> Confirmed -> Picking -> Packed -> Out for Delivery -> Delivered.
  - Delivery OTP display card (for the customer to provide to the delivery partner).
  - Delivery partner card with direct call button.
  - Items ordered list featuring **individual item "Buy again" buttons** (`_buyItemAgain`) alongside "Rate item" reviews.
  - Cancellation sheet (`_CancelSheet`) allowing order cancellation prior to dispatch.
  - Native PDF invoice generation and download via `invoice.dart`.
- **`RateOrderScreen`**:
  - Overall delivery and food rating with multi-star picker, quality tag pills, and review comment field.

#### 8. Profile & Customer Support (`features/profile/profile_screens.dart`)
- **`ProfileScreen`**:
  - User header with avatar, name, phone, email, and "Edit Profile" shortcut.
  - Quick stat counters: Saved Addresses, Wishlist count, Active Orders.
  - Menu list: Orders, Addresses, Wishlist, Notifications, Offers, Help & Support, Settings, Sign Out.
- **`EditProfileScreen`**:
  - Update full name, email address, phone number, and profile picture.
- **`WishlistScreen`**:
  - Saved favorites grid with quick "Add to Cart" and delete swipe.
- **`OffersScreen`**:
  - Catalog of active discount codes with one-tap copy and expiry details.
- **`NotificationsScreen`**:
  - Real-time customer notification feed with unread indicators, deep links to orders/products, and swipe-to-delete.
- **`HelpScreen`**:
  - Customer support ticket creation sheet (`_TicketSheet`), support phone/email shortcuts, and interactive FAQ list.
- **`MoreScreen`**:
  - App theme toggle (System / Light / Dark via `themeModeProvider`), cache clearing, version number, legal policy links.
- **`LegalScreen` & Info Screens (`legal_screens.dart`)**:
  - In-app markdown view for Privacy Policy, Terms of Service, Refund Policy, Shipping Policy, and About Us.

---

## 5. Reusable Design System & Component Library

### 5.1 Color Tokens & Theming (`mobile/lib/core/theme.dart`)
- **Palette Principles**:
  - Brand Primary: Forest Green (`#0B3D2E` / `#064E3B`).
  - Accent Highlight: Sunburst Orange (`#F58220`).
  - Natural Cream Background: `#FBF7EE`.
  - Deep Ink Typography: `#202923`.
  - Border Lines: `#EBE5DA`.
- **Adaptive Architecture (`VsrPalette`)**:
  - Built using Flutter `ThemeExtension<VsrPalette>` accessible via `context.vsr.<token>`:
    - `bg`, `surface`, `line`, `lineSoft`, `ink`, `muted`, `brandText`, `brand50`, `brand100`, `accent50`, `statusFg`, `statusBg`.
  - Eliminates hardcoded colors, ensuring instant and seamless Light / Dark mode responsiveness.
- **Spacing & Radius Constants**:
  - `VsrSpace`: 4-pt grid system (`gutter: 16`, `sectionTop: 28`, `sectionBottom: 12`, `group: 12`, `row: 8`, `navClearance: 120`).
  - `VsrRadius`: `sm: 10`, `md: 14`, `lg: 18`.

### 5.2 Standardized UI Widgets (`mobile/lib/widgets/common.dart`)
- **`ProductTile`**:
  - Standardized product card engineered to prevent flex overflow bugs.
  - Fixed-ratio product image container with "Out of stock" overlay badge.
  - Compact title, pack-size subtitle, and rating stars.
  - Price & MRP using wrapped flex layout (`Wrap`) to accommodate varied currency lengths without clipping.
  - Integrated `AddToCartButton` with loading animations and dynamic quantity stepper.
- **`ProductRail`**:
  - Horizontal scrolling list of `ProductTile` cards bounded to a standardized 314pt height.
- **`BottomCta`**:
  - Standard bottom action bar with `double.infinity` full-width alignment, 48pt height touch targets, and safe area insets.
- **`QtyStepper`**:
  - Compact plus/minus stepper widget for cart and card interactions.
- **`NotifyMeButton`**:
  - Back-in-stock subscription button with animated state feedback.
- **`TileGroup` & `NavTile`**:
  - Unified iOS/Material grouped list tiles for settings and profile navigation.
- **`PriceTag` & `BillRow`**:
  - Formatted currency rendering with strikethrough MRP and discount badges.
- **`AsyncBody` & `LoadingView`**:
  - Shimmering skeleton loaders with error states and pull-to-refresh integration.

---

## 6. Recent UI Bug Fixes & Refinement History

1. **ProductTile Overflow Elimination (`mobile/lib/widgets/common.dart`)**:
   - Fixed: Bottom flex overflow of 3.9px and right overflow of 6.3px.
   - Solution: Relocated "Out of stock" chip onto the media stack, changed price and MRP row to `Wrap`, tightened padding to 10px, and standardized internal SizedBox spacing.
2. **ProductRail & Home Header Height Tightening**:
   - Fixed: Excessive vertical dead space between sections on the home screen.
   - Solution: Tightened `ProductRail` height to 314pt and reduced `_HomeHeader` minimum body height from 166pt to 150pt.
3. **Dynamic Piece Calculation in Cart (`mobile/lib/features/checkout/checkout_screens.dart`)**:
   - Fixed: Static unit text ("1 pc") remained unchanged when item quantities were increased.
   - Solution: Updated `_cartItemUnit(it)` to multiply the unit count by the active line item quantity (e.g., dynamically displaying "7 pcs · In stock").
4. **Individual Item "Buy Again" in Orders (`mobile/lib/features/orders/order_screens.dart`)**:
   - Fixed: Customers could only reorder the entire order, without the ability to buy an individual product again.
   - Solution: Added `_buyItemAgain` button on every order line item inside `OrderDetailScreen`, allowing single-item reorders directly to cart.
5. **Standardized Bottom CTA Layout (`mobile/lib/widgets/common.dart`)**:
   - Fixed: Cart and checkout action buttons appeared centered or truncated on wide displays.
   - Solution: Standardized `BottomCta` to stretch across the full available width with a 48px height touch target.
6. **Code Analysis & Health**:
   - Full workspace verified with `dart analyze mobile/lib` returning **0 errors and 0 warnings**.

---

## 7. Operational Guidelines & Commands

- **Backend Development**:
  ```bash
  cd backend
  npm run dev          # Starts TypeScript server on http://localhost:5050
  ```
- **Frontend Development**:
  ```bash
  cd frontend
  npm run dev          # Starts Vite dev server (Storefront + Admin)
  ```
- **Mobile Development & Device Sync**:
  ```bash
  cd mobile
  # If running on Android device via USB:
  adb reverse tcp:5050 tcp:5050
  flutter run
  ```
- **Type Checking & Linting**:
  ```bash
  # Backend
  cd backend && npx tsc --noEmit
  # Frontend
  cd frontend && npm run build
  # Mobile
  cd mobile && dart analyze lib
  ```
