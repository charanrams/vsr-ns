# VSR Marketplace --- Product Requirements Document (PRD)

**Version:** 1.0\
**Status:** Initial product specification\
**Product:** VSR --- Shop · Eat · Live Better\
**Platforms:** Customer mobile app, Admin web portal, Delivery partner
mobile app\
**Primary market:** India\
**Currency:** INR (₹)\
**Technology stack:** MERN for the backend and admin web portal
(MongoDB, Express.js, React.js, Node.js); Flutter for customer and
delivery mobile apps; Cloudinary for image storage; Nodemailer for
email; Razorpay for payments.

------------------------------------------------------------------------

## 1. Executive Summary

VSR is a multi-category commerce and local delivery platform that allows
customers to purchase everyday products, groceries, household goods,
fashion, electronics, beauty and personal care products, kids' products,
and homemade food through a single customer mobile app. An admin web
portal manages the catalogue, customer bookings/orders, inventory,
payments, promotions, support, and delivery operations. A delivery
partner app allows verified partners to receive assignments, collect
orders, navigate to customers, and confirm delivery using an OTP.

The central business workflow is: **customer places an order → admin
receives the booking → stock and payment are validated → admin accepts
or rejects the order → order is prepared and packed → delivery partner
is assigned → customer tracks the order → delivery is verified → order
is completed**.

The product should be designed as a reliable, secure, scalable
marketplace, not as a static UI prototype. All critical operations must
be validated by the backend and stored with an auditable history.

## 2. Product Vision and Goals

### 2.1 Vision

Make VSR a trusted, convenient destination for shopping and homemade
food, with clear order visibility and dependable local delivery.

### 2.2 Business goals

-   Launch a single marketplace across multiple product categories and
    homemade food.
-   Give admins a reliable way to see and process every customer
    booking.
-   Prevent overselling through stock reservation and atomic inventory
    updates.
-   Provide transparent pricing, payment status, order status, and
    refund handling.
-   Enable delivery assignment, customer tracking, and OTP-based
    delivery confirmation.
-   Build a consistent premium VSR experience across mobile and web.
-   Support future growth in categories, service areas, order volume,
    and operational roles.

### 2.3 Success metrics

-   Order placement success rate.
-   Order acceptance/rejection time.
-   Inventory mismatch and overselling rate.
-   Payment success and reconciliation rate.
-   On-time delivery rate.
-   Order cancellation and refund completion time.
-   Repeat purchase rate and customer retention.
-   Support ticket first-response and resolution time.
-   App crash-free sessions and API availability.

Targets should be set after baseline data is collected during pilot
operations.

## 3. Scope

### 3.1 In scope

-   Customer onboarding, login, OTP verification, password recovery,
    profile and addresses.
-   Product discovery, categories, search, filtering, sorting, product
    details and cart.
-   Checkout, delivery slot/address selection, coupons, payment and
    order confirmation.
-   Order history, tracking, cancellation/return eligibility, reviews
    and support.
-   Admin dashboard and management of orders, products, categories,
    inventory, customers, delivery partners, payments, promotions,
    reports, support and settings.
-   Delivery partner onboarding, availability, assigned orders, pickup
    confirmation, navigation, delivery OTP and earnings history.
-   Homemade food catalogue, kitchen/chef profiles, menu and
    availability information.
-   Push notifications and transactional notifications.
-   Role-based access, audit logs and operational reports.

### 3.2 Out of scope for initial release unless separately approved

-   International shipping or multi-currency support.
-   Marketplace seller self-service portal.
-   Automated dynamic pricing driven by AI.
-   Full accounting/ERP integration.
-   Lending, credit, or buy-now-pay-later services.
-   Guaranteed live GPS tracking when the delivery app is offline or
    permission is denied.
-   Wallet/loyalty points until business rules and liability handling
    are approved.

## 4. Users and Roles

### 4.1 Customer

Browses products and homemade food, manages account and addresses,
places and pays for orders, tracks delivery, and requests support.

### 4.2 Super Admin

Full platform configuration, admin user management, permissions, audit
logs, reports, and operational oversight.

### 4.3 Order Manager

Views incoming orders, checks payment and stock, accepts/rejects orders,
coordinates preparation and packing, and assigns delivery partners
according to permissions.

### 4.4 Catalogue Manager

Creates and edits products, categories, product images, pricing,
variants, and product visibility.

### 4.5 Inventory Manager

Maintains stock levels, handles adjustments, reviews low-stock alerts,
and investigates stock movements.

### 4.6 Finance Manager

Reviews transactions, payment reconciliation, refunds, fees, taxes, and
financial reports.

### 4.7 Support Agent

Handles support tickets, complaints, returns, and customer communication
within permitted access.

### 4.8 Delivery Partner

Sets availability, accepts or receives assignments, confirms pickup,
navigates to the customer, completes OTP verification, and views
delivery history.

Role permissions must follow least-privilege access. One user may have
multiple roles only when explicitly granted by a Super Admin.

## 5. Brand and UX Requirements

### 5.1 Brand identity

-   Brand name: **VSR**
-   Tagline: **Shop · Eat · Live Better**
-   Primary color: Forest green, suggested `#064E3B` or `#0B4D3B`
-   Accent color: Orange, suggested `#F58220`
-   Background: Warm cream, suggested `#FFF9EF`
-   Surface: White, suggested `#FFFFFF`
-   Text: Deep charcoal, suggested `#202923`
-   Secondary text: Muted grey, suggested `#69736F`
-   Success: `#25834A`
-   Warning: `#E99A18`
-   Error: `#C9362B`
-   Borders: Warm neutral, suggested `#E8E2D8`

Colors are design recommendations and should be finalized in a design
system. Maintain contrast and do not rely on color alone to communicate
state.

### 5.2 UX principles

-   Clear hierarchy and readable text.
-   Minimal, purposeful decoration; no food/product imagery on
    authentication screens unless requested.
-   Large touch targets and accessible labels.
-   Consistent loading, empty, success, offline and error states.
-   Clear prices and item quantities.
-   Explicit confirmation for destructive actions.
-   Responsive admin web layouts.
-   Use real product images and realistic content; generated mockups are
    visual references, not production assets.
-   Use a safe-area-aware bottom navigation on customer and delivery
    apps.

### 5.3 Customer app bottom navigation

Recommended: **Home, Categories, Cart, Orders, Profile**. The central
Cart action may be visually emphasized while retaining accessible
labels.

## 6. Customer Mobile App Requirements

### 6.1 Splash and onboarding

**Screens** 1. Splash screen with VSR logo and tagline. 2. Onboarding 1:
Fresh products and everyday essentials. 3. Onboarding 2: Explore wide
categories. 4. Onboarding 3: Shopping and homemade food in one place. 5.
Permission prompts only when the user invokes a feature requiring them.

**Requirements** - Show onboarding only for first-time users or until
completed. - Allow Skip and Next actions. - Do not request location
permission before explaining its purpose. - Route authenticated users to
Home; unauthenticated users to login or guest browsing according to
business decision.

### 6.2 Authentication

**Screens** - Enter email or phone number. - Email sign-in: enter
password. - Phone sign-in: enter OTP. - Email OTP verification when used
for account verification or password recovery. - Forgot password:
select/use registered email or phone, send OTP, verify OTP, create new
password, success screen. - Sign up: name, email/phone, password if
email-based registration is enabled, consent to terms. - OTP resend
timer and change-contact option. - Logout confirmation.

**Rules** - Login entry accepts email or phone number. - If email is
entered, continue to password screen. - If phone number is entered, send
OTP and continue to OTP screen. - Do not send password-reset links.
Password recovery must use OTP sent to the registered email or phone. -
OTP must expire after a configurable short period, be single-use, and
have rate limits and attempt limits. - Do not reveal whether an email or
phone is registered through overly specific error messages. - Passwords
must be securely hashed server-side; never store plain-text passwords. -
"Keep me logged in" must use secure token/session handling and must not
bypass server-side expiry or revocation.

### 6.3 Home and discovery

**Screens** - Home dashboard. - Delivery location selector and saved
address selector. - Search input with suggestions and recent searches. -
Search results. - Category listing. - Product listing by category. -
Filters and sorting. - Offers and campaign details. - Best sellers,
recommendations and recently viewed items. - Homemade food discovery and
kitchen/chef profiles.

**Home layout** - Header with VSR logo, delivery location, notification
icon and cart icon with count badge. - Search bar with optional scan
icon only if scanning is supported. - Promotional carousel. - Quick
shortcuts: Offers, Same Day (only if serviceable), Premium, Homemade
Food and More. - Category grid. - Best for You / Best Sellers product
carousel. - Homemade food section. - Recently viewed and personalized
sections where enough data exists. - Persistent bottom navigation.

**Requirements** - Location and delivery availability should be
visible. - Product availability must respect service area and stock. -
Promotions must use active dates and eligibility rules from the
backend. - Do not show invented live delivery estimates.

### 6.4 Product catalogue

**Screens** - Product details. - Image gallery. - Variant/size
selection. - Quantity selector. - Wishlist. - Reviews and ratings. -
Product questions where enabled. - Similar/recommended products.

**Product data** - Product name, SKU, category, description, images,
price, sale price, tax treatment, variant options, stock status,
unit/size, seller or kitchen where relevant, delivery eligibility,
return eligibility, ingredients/allergens for food, and product status.

**Rules** - Revalidate price and availability at cart and checkout. -
Display unit price and quantity clearly. - Show allergens and
preparation/storage notes for homemade food when supplied. - Do not
claim a product is safe, certified, organic, or allergen-free without
verified data.

### 6.5 Cart

**Screens** - Cart. - Quantity update. - Remove item confirmation. -
Coupon selection. - Cart empty state.

**Requirements** - Display line-item quantity, unit price, discount,
line total and stock warnings. - Validate stock before checkout. -
Explain if a product becomes unavailable. - Apply coupons only after
server validation. - Calculate totals server-side; client totals are for
preview only.

### 6.6 Checkout

**Screens** - Select/add/edit address. - Map pin selection (optional and
permission-based). - Delivery slot selection (if supported). - Order
summary. - Coupon selection. - Payment method. - Payment
processing/pending. - Payment failed/retry. - Order confirmation.

**Price breakdown** - Item subtotal. - Item-level discounts. - Coupon
discount. - Delivery fee. - Packaging fee, if applicable. - Taxes. -
Final payable total.

**Payment requirements** - Support payment methods selected by the
business (e.g., UPI, cards, net banking, cash on delivery if
approved). - Use a compliant payment gateway; never store card
details. - Verify payment status server-side using trusted gateway
callbacks/webhooks. - Use idempotency controls to prevent duplicate
orders or duplicate payment processing. - If payment is pending, show
pending state and reconcile before treating it as paid. - A paid order
that is later rejected must enter the approved refund workflow.

### 6.7 Orders and tracking

**Screens** - My Orders tabs: Active, Delivered, Cancelled. - Order
details. - Order timeline. - Live delivery location (when supported). -
Delivery partner details/contact options. - Cancel order and reason. -
Return/replacement request where eligible. - Refund status. - Invoice
download. - Reorder.

**Suggested order states**
`Placed → Awaiting Admin Review → Confirmed → Picking/Preparing → Packed → Assigned → Picked Up → Out for Delivery → Delivered`

Alternative terminal states: `Rejected`, `Cancelled`,
`Return Requested`, `Returned`, `Refund Pending`, `Refunded`,
`Delivery Failed`.

Transitions must be controlled by backend business rules and recorded in
order history. Do not allow arbitrary state jumps from the client.

**Delivery confirmation** - Delivery partner enters or verifies a
server-generated delivery OTP. - OTP should be time-bound,
attempt-limited and invalidated after successful use. - Customer sees
delivered status only after server confirmation.

### 6.8 Reviews and support

**Screens** - Rate order/product. - Write review. - Help & Support. -
FAQ. - Create ticket. - Ticket details and replies. - Report
missing/damaged item. - Return/refund request.

Reviews should be linked to eligible purchases and moderated according
to policy. Support messages must not expose private information to
unauthorized users.

### 6.9 Profile and settings

**Screens** - Profile overview. - Edit profile. - Saved addresses. -
Notifications. - Wishlist. - Privacy policy. - Terms and conditions. -
Account deletion request. - App settings. - Logout confirmation.

## 7. Admin Web Portal Requirements

### 7.1 Shared admin shell

-   Persistent sidebar with collapsible navigation.
-   Global search for orders, customers and products.
-   Notification center.
-   Admin profile and role.
-   Breadcrumbs.
-   Date filters where relevant.
-   Responsive tables and detail layouts.
-   Consistent loading, empty, error and permission-denied states.

### 7.2 Dashboard Overview

**KPIs** - Orders today. - Revenue today/selected period. - Pending
admin review. - Active customers. - Active products. - Low/out-of-stock
products. - Orders out for delivery. - Refunds awaiting action.

**Widgets** - Revenue and order trends. - Order status distribution. -
Sales by category. - Recent orders. - Low-stock alerts. - Top-selling
products. - Delivery partner availability. - Recent activity/audit
events. - Quick actions: Add Product, View New Orders, Adjust Stock,
Create Offer.

Dashboard values must come from APIs and respect the selected time range
and the admin's permissions.

### 7.3 Orders

**Pages** - All Orders. - New Orders. - Order Details. - Processing
Orders. - Ready/Packed Orders. - Out for Delivery. - Delivered. -
Rejected/Cancelled. - Return and replacement requests. - Refund
management.

**Order details must show** - Order number and timestamp. - Order status
timeline. - Customer details and contact permissions. - Delivery address
and instructions. - Item list with image, SKU, unit price, quantity,
line total, requested quantity and stock status. - Available, reserved
and requested stock. - Payment method, gateway transaction reference and
payment status. - Item subtotal, discounts, delivery/packaging fees, tax
and final total. - Delivery assignment. - Internal notes. - Status
history and actor/timestamp.

**Accept order** 1. Revalidate product status and inventory on the
server. 2. Atomically reserve required stock. 3. Verify payment state or
approved payment mode. 4. Confirm order and record admin, time and state
transition. 5. Notify customer. 6. Make preparation/fulfillment tasks
available.

If stock is insufficient, prevent acceptance or require an explicit
supported partial-fulfillment workflow. Never rely on a client-side
inventory check alone.

**Reject order** - Require a rejection reason. - Record actor, timestamp
and reason. - Release any reserved inventory. - If payment was
collected, create a refund task according to policy and show its
state. - Notify customer without claiming a refund is complete until
confirmed by the payment provider.

### 7.4 Products

-   Product list with search, filters and pagination.
-   Add/edit product.
-   Product details.
-   Product images and image ordering.
-   Category/subcategory selection.
-   SKU and variant management.
-   Pricing and sale pricing.
-   Tax configuration references.
-   Inventory linkage.
-   Product status: Draft, Active, Inactive, Archived.
-   Product review moderation.
-   Bulk import/export with validation and error report.

### 7.5 Categories

-   Category list.
-   Add/edit category.
-   Parent category and subcategory management.
-   Category image, description, slug and display order.
-   Visibility and active status.
-   Prevent deletion when dependent products exist unless products are
    reassigned.

An accordion interface may group related category tasks, but forms
should remain accessible, validated and usable on smaller screens.

### 7.6 Inventory

-   Stock overview.
-   Low stock and out-of-stock lists.
-   Stock adjustment.
-   Stock movement history.
-   Reserved stock and available stock.
-   Threshold configuration.
-   Stock import/export.
-   Damaged/expired stock adjustment where applicable.

Every stock adjustment must record product/variant, quantity delta,
reason, actor, timestamp and reference. Available stock must be computed
consistently, e.g. `onHand - reserved`, with concurrency-safe updates.

### 7.7 Customers

-   Customer list.
-   Customer details.
-   Contact and verification state.
-   Saved addresses with appropriate access controls.
-   Order history.
-   Refund/support history.
-   Account status and risk flags where policy permits.
-   Customer notes restricted to authorized staff.

### 7.8 Delivery partners and operations

-   Delivery partner list and details.
-   Onboarding/KYC review.
-   Online/offline status.
-   Service area and capacity.
-   Delivery assignment.
-   Live map (only with appropriate consent, permissions and active
    location sharing).
-   Delivery history and performance.
-   Delivery failure and reassignment.
-   Delivery fee and zone configuration.

Assignment should consider availability, service area, distance, current
workload and operational rules. Admins must be able to manually override
recommendations if authorized, with audit history.

### 7.9 Payments and refunds

-   Transaction list.
-   Transaction details.
-   Payment state and gateway references.
-   Failed/pending payments.
-   Refund requests and status.
-   Reconciliation report.
-   Fees and settlement references where available.

Payment states should be distinct from order states, e.g. `Pending`,
`Authorized`, `Paid`, `Failed`, `Partially Refunded`, `Refund Pending`,
`Refunded`. All final payment states must be based on verified provider
data.

### 7.10 Banners, offers and marketing

-   Banner list/create/edit.
-   Campaign scheduling.
-   Coupon management.
-   Eligibility rules: category, products, minimum cart value, user
    eligibility and date range.
-   Usage limits and per-customer limits.
-   Active/inactive status.
-   Preview before publishing.

### 7.11 Notifications

-   Notification center.
-   Create/send notification.
-   Target audience selection.
-   Notification templates.
-   Send status and delivery history.
-   Transactional order notifications.
-   Push notifications and email/SMS through configured providers.

Avoid sending promotional messages without required consent. Do not
expose secrets or personal information in notification payloads.

### 7.12 Support and returns

-   Support ticket list.
-   Ticket detail and assignment.
-   Customer replies and internal notes.
-   Return/replacement eligibility.
-   Evidence attachments.
-   Refund linkage.
-   Resolution status and SLA tracking.

### 7.13 Reports

-   Sales and revenue.
-   Order funnel and status.
-   Product performance.
-   Category performance.
-   Customer retention and repeat orders.
-   Inventory and stock movement.
-   Delivery performance.
-   Payment/refund reconciliation.
-   Export to CSV/Excel where authorized.

### 7.14 Settings and security

-   General business settings.
-   Admin user management.
-   Roles and permissions.
-   Service areas.
-   Delivery, packaging and tax configuration.
-   Payment gateway configuration.
-   Notification provider configuration.
-   Audit logs.
-   Session/security settings.
-   Data retention and privacy settings.

Secrets must be stored in environment/secret management, never in source
control or returned to the frontend.

## 8. Delivery Partner Mobile App Requirements

### 8.1 Authentication and onboarding

-   Login.
-   OTP verification/password recovery according to approved policy.
-   Partner profile.
-   KYC document upload and verification status.
-   Bank/payout details with secure handling.
-   Terms and privacy consent.

### 8.2 Home and availability

-   Delivery dashboard.
-   Go Online / Go Offline confirmation.
-   Assigned orders.
-   Earnings summary.
-   Notifications.
-   Break tracker and duty history only if included in operational
    policy.

### 8.3 Delivery workflow

1.  Receive assigned order.
2.  View pickup location, order reference and instructions.
3.  Accept assignment or report inability, according to policy.
4.  Navigate to pickup.
5.  Verify pickup with a code or admin/merchant confirmation.
6.  Mark picked up.
7.  Navigate to customer.
8.  Contact customer through permitted masked/contact methods.
9.  Enter delivery OTP.
10. Complete delivery and sync status.
11. View delivery history and earnings.

### 8.4 Delivery partner screens

-   Dashboard.
-   Online/offline status.
-   New assignment.
-   Order details.
-   Pickup verification.
-   Navigation/live location.
-   Delivery OTP verification.
-   Delivery success.
-   Cancellation/rejection reason.
-   Earnings and payout history.
-   Bank details and KYC.
-   Notifications.
-   Help & Support.
-   Break tracker/duty history if enabled.
-   Edit profile.
-   Privacy policy and terms.
-   Logout confirmation.

### 8.5 Location requirements

-   Request location permission in context.
-   Explain when location is collected and why.
-   Track only during active duty/order states according to policy.
-   Show clear location-sharing status.
-   Handle denied permissions, GPS disabled and network loss.
-   Do not claim continuous tracking when the device cannot provide
    updates.

## 9. Homemade Food Requirements

Homemade food requires additional data and operational rules because
availability and preparation may differ from packaged goods.

-   Kitchen/chef profile and verification state.
-   Food menu and category.
-   Ingredients and allergen information where provided.
-   Portion/serving selection.
-   Preparation time and order cut-off.
-   Daily availability and quantity limits.
-   Food-specific cancellation and refund policy.
-   Packaging and handling instructions.
-   Food order status:
    `Placed → Accepted → Preparing → Ready for Pickup → Picked Up → Delivered`.
-   Kitchen/food availability must be checked during checkout and order
    acceptance.
-   Admin can pause a kitchen/menu item when unavailable.
-   Any food safety or regulatory claims must be verified and approved
    before display.

Whether kitchens are managed by VSR staff or independent partners must
be confirmed before implementation.

## 10. Core Business Rules

1.  Every order receives a unique, non-guessable public order number and
    internal identifier.
2.  Backend is the source of truth for price, discount, tax, inventory,
    payment and order state.
3.  Product price and stock are revalidated at checkout and order
    acceptance.
4.  Stock reservation and order creation must be atomic or recoverable
    through a transaction/saga pattern.
5.  Payment webhooks must be signature-verified and idempotent.
6.  A successful payment does not automatically mean the order has been
    accepted.
7.  Rejected/cancelled paid orders require a traceable refund workflow.
8.  Status changes must record actor, timestamp, previous state, new
    state and reason when relevant.
9.  Delivery OTP must be single-use, time-limited and attempt-limited.
10. Admin actions must be authorized by role and logged.
11. Customer address and contact details must be accessible only for
    legitimate order/support workflows.
12. All user input must be validated on both client and server.
13. Empty, loading, error and offline states must be implemented for all
    major data screens.
14. Duplicate taps, retries and network resubmissions must not create
    duplicate orders or payments.
15. Product/category deletion must protect historical order records and
    references.

## 11. Suggested Data Model

The following is an initial domain model. Exact schemas and
relationships should be finalized during architecture design.

-   **User**: name, email, phone, password hash if applicable,
    verification status, role references, account status, timestamps.
-   **CustomerProfile**: user reference, preferences, saved addresses,
    consent flags.
-   **Address**: customer reference, label, recipient, phone, address
    lines, landmark, city, state, postal code, coordinates, default
    flag.
-   **Category**: name, slug, description, image, parent category,
    display order, status.
-   **Product**: name, slug, SKU, description, category references,
    images, attributes, tax reference, status.
-   **ProductVariant**: product reference, variant attributes, SKU,
    price, sale price, unit, stock reference, status.
-   **Inventory**: variant reference, on-hand quantity, reserved
    quantity, threshold, updated timestamp.
-   **InventoryMovement**: variant, delta, reason, actor, timestamp,
    reference.
-   **Cart**: customer, line items, updated timestamp; checkout must
    revalidate all data.
-   **Order**: public order number, customer, line-item snapshots,
    address snapshot, totals, payment state, order state, delivery
    reference, timestamps.
-   **OrderItem**: product/variant snapshot, SKU, unit price, quantity,
    discount/tax snapshot, line total.
-   **OrderStatusHistory**: order, old/new state, actor, reason,
    timestamp.
-   **Payment**: order, provider, provider transaction reference,
    amount, currency, state, verified timestamps.
-   **Refund**: payment/order, amount, reason, provider reference,
    state, timestamps.
-   **Coupon/Campaign**: code, rules, eligibility, validity, limits,
    status.
-   **DeliveryPartnerProfile**: user, verification state, service areas,
    availability, vehicle/details if required.
-   **DeliveryAssignment**: order, partner, assignment state,
    timestamps, location snapshots where permitted.
-   **DeliveryEvent**: order, event, actor, timestamp, optional
    coordinates.
-   **KitchenProfile**: owner/manager, name, verification state,
    address/service area, opening hours.
-   **FoodAvailability**: kitchen/product, date/slot, quantity limit,
    availability state.
-   **Review**: customer, order/item, rating, text, moderation state.
-   **SupportTicket**: customer, order, category, priority, messages,
    assigned agent, status.
-   **Notification**: recipient/audience, channel, template, delivery
    state, timestamps.
-   **AuditLog**: actor, action, resource type/id, before/after summary,
    timestamp, request correlation ID.

Use immutable snapshots in order items and address data so historical
orders remain accurate when catalogue or address records change.

## 12. API Requirements

Use versioned REST APIs, e.g. `/api/v1`. All endpoints require
authentication/authorization as appropriate, input validation,
consistent error responses and request correlation IDs.

Example endpoint groups: - `/auth`: login, signup, send OTP, verify OTP,
forgot password, reset password, logout, refresh session. - `/users`,
`/customers`, `/addresses`. - `/categories`, `/products`, `/search`,
`/reviews`. - `/cart`, `/coupons`, `/checkout`. - `/orders`,
`/orders/:id/status`, `/orders/:id/cancel`. - `/payments`,
`/webhooks/payments`, `/refunds`. - `/inventory`,
`/inventory/movements`. - `/delivery-partners`, `/delivery-assignments`,
`/delivery-events`. - `/kitchens`, `/food-availability`. -
`/notifications`, `/support-tickets`. - `/admin/dashboard`,
`/admin/reports`, `/admin/settings`, `/admin/users`,
`/admin/audit-logs`.

Use pagination and filtering for list endpoints. Avoid returning
internal fields or unnecessary personal data. Payment webhook endpoints
must verify signatures and reject invalid requests.

## 13. Technology Stack and Integration Requirements

### 13.1 MERN stack

-   **MongoDB:** Primary database.
-   **Express.js:** REST API framework.
-   **React.js + TypeScript:** Admin web portal.
-   **Node.js + TypeScript:** Backend services and business logic.
-   **Mongoose:** MongoDB schema definitions, validation, indexes and
    data access.
-   **Flutter:** Customer mobile app and delivery partner mobile app.

Keep business rules on the backend. The React admin portal and Flutter
apps must call authenticated APIs rather than directly accessing
MongoDB.

### 13.2 Cloudinary image management

-   Use Cloudinary for product, category, banner, kitchen/chef and
    support-evidence images where appropriate.
-   Upload images through a backend-generated signed upload flow or a
    backend upload endpoint; do not expose Cloudinary API secrets in
    web/mobile clients.
-   Store Cloudinary `public_id`, secure URL, resource type, dimensions
    and relevant metadata in MongoDB.
-   Validate file type, file size and upload permissions.
-   Support image ordering, replacement and deletion.
-   Use optimized responsive image transformations and thumbnails.
-   When a product or category image is replaced, avoid breaking
    historical order records or audit references.

### 13.3 Nodemailer email

-   Use Nodemailer for transactional email through a configured SMTP
    provider.
-   Use email for OTP delivery, account verification, order
    confirmations, payment/order updates, refund updates and support
    notifications as appropriate.
-   Keep SMTP credentials in environment variables or a secret manager;
    never commit them to source control.
-   OTPs must expire, be single-use, rate-limited and attempt-limited.
-   Store only the minimum OTP verification data needed; never log raw
    OTPs.
-   Implement delivery failure handling and safe resend behavior.
-   SMS OTP delivery is a separate provider integration if phone-based
    login requires SMS; Nodemailer sends email and cannot deliver SMS by
    itself.

### 13.4 Razorpay payments

-   Use Razorpay as the payment gateway for supported payment methods.
-   Create payment orders on the Node.js backend and return only the
    required public checkout details to the Flutter app.
-   Verify Razorpay payment signatures on the backend.
-   Verify webhook signatures and make webhook processing idempotent.
-   Never trust a client-only success callback as proof of payment.
-   Store Razorpay order/payment/refund IDs, amount, currency and
    verified status in MongoDB.
-   Do not store card numbers, CVVs or other sensitive payment
    credentials.
-   Implement pending, successful, failed and refund states, with
    reconciliation for delayed or duplicate webhooks.
-   Keep Razorpay keys and webhook secrets out of frontend/mobile source
    code.

### 13.5 Configuration and environment

-   Use environment-specific configuration for database connection,
    JWT/session secrets, Cloudinary, SMTP/Nodemailer and Razorpay.
-   Provide a `.env.example` with variable names and placeholder values
    only.
-   Validate required configuration at application startup.
-   Do not include deployment, hosting, infrastructure provisioning or
    CI/CD requirements in this PRD.

## 14. Non-Functional Requirements

### Performance

-   Define performance budgets during implementation.
-   Paginate long lists and use optimized image sizes.
-   Use caching only where it cannot produce stale stock/payment
    decisions.
-   Optimize common product and home endpoints.

### Reliability

-   Handle provider timeouts, duplicate webhooks and transient network
    errors.
-   Add retry policies for safe idempotent operations.
-   Provide operational logs and alerts.
-   Back up databases and test restore procedures.

### Security

-   HTTPS for all production traffic.
-   Secure password hashing (e.g. Argon2id or bcrypt with suitable
    parameters).
-   Short-lived access tokens and securely managed refresh sessions.
-   OTP rate limiting and brute-force protection.
-   Role-based access control and server-side authorization.
-   Input validation, output encoding and protection against injection.
-   Secrets in managed environment variables/secret storage.
-   Audit sensitive admin operations.
-   Encrypt sensitive data in transit and at rest where supported.
-   Do not log passwords, OTPs, full payment credentials or unnecessary
    personal information.

### Privacy

-   Collect only data needed for service delivery.
-   Obtain consent for location and marketing communications as
    required.
-   Provide privacy policy and account deletion/request workflows.
-   Set data retention and access policies.
-   Restrict delivery partner access to assigned-order information.

### Accessibility

-   Readable contrast, scalable text and accessible labels.
-   Screen-reader semantics for interactive elements.
-   Do not use color alone for status.
-   Ensure controls are reachable and usable on small screens.

### Compatibility

-   Support agreed Android/iOS versions and admin browsers.
-   Test responsive web layouts for desktop and tablet.
-   Define offline behavior for delivery workflows.

## 15. Notifications and Messaging

Transactional messages may include: - OTP requested. - Account
verification. - Order placed. - Order accepted/rejected. - Payment
pending/confirmed/failed. - Order being prepared/packed. - Delivery
partner assigned. - Out for delivery. - Delivered. - Cancellation and
refund updates. - Support ticket updates.

Channels may include push notifications, SMS and email, depending on
provider setup, consent, cost and regional requirements. Messages should
be generated from backend events and be idempotent.

## 16. Analytics and Auditability

Track operational events without collecting unnecessary sensitive
data: - Authentication success/failure. - Search and category
interactions. - Add/remove cart items. - Checkout started/completed. -
Order placed/accepted/rejected/cancelled. - Payment result and
reconciliation. - Stock adjustment and stock-out. - Delivery assignment,
pickup and completion. - Refund lifecycle. - Support resolution.

Admin audit logs should record who performed sensitive changes and when.
Do not store passwords, raw OTPs or payment secrets in logs.

## 17. Error, Empty and Loading States

Each major screen must handle: - Initial loading and refresh. - No
products/orders/results. - No internet connection. - API timeout or
server error. - Expired session. - Permission denied. - Location
unavailable. - Out-of-stock item. - Price changed since item was
added. - Payment pending/failed. - Invalid or expired OTP. - Delivery
assignment unavailable. - Refund pending or failed.

Provide a useful recovery action such as Retry, Edit Cart, Change
Address, Resend OTP, Contact Support or Return Home, where appropriate.

## 18. Acceptance Criteria

### Authentication

-   Email input routes to password login.
-   Phone input routes to OTP verification.
-   Forgot password sends OTP to the registered channel; no reset link
    is used.
-   Expired or invalid OTP cannot be accepted.
-   Rate limits prevent repeated abuse.

### Customer ordering

-   Customer can browse categories, search products, view details and
    add items to cart.
-   Checkout displays a server-validated price breakdown.
-   Order is not duplicated after retries.
-   Customer sees accurate order and payment states.

### Admin order handling

-   New bookings appear in the admin order list.
-   Admin can view item-level quantities, address, payment and stock
    state.
-   Accept action revalidates stock and payment.
-   Reject action requires a reason.
-   Paid rejected orders create a refund workflow.
-   All important state changes are auditable.

### Inventory

-   Available and reserved quantities are distinct.
-   Concurrent orders cannot oversell stock.
-   Every manual stock change has a reason and audit record.
-   Low-stock alerts follow configured thresholds.

### Delivery

-   Only authorized/eligible partners can access assigned orders.
-   Pickup and delivery events update the backend.
-   Delivery OTP is verified server-side.
-   Customer sees delivered state only after successful confirmation.

### Admin security

-   Unauthorized roles cannot access protected screens or APIs.
-   Sensitive actions are logged.
-   Secrets are not exposed to frontend clients.

## 19. Delivery Plan and Milestones

### Phase 0 --- Discovery and design

-   Confirm launch categories and service area.
-   Finalize business rules, delivery fees, cancellation and return
    policies.
-   Finalize user flows and design system.
-   Confirm payment, OTP, maps, notification and analytics providers.

### Phase 1 --- Foundation

-   Repository setup and coding standards.
-   MERN backend configuration, MongoDB models/indexes, authentication,
    roles, logging and error handling.
-   React admin web foundation and Flutter app foundations.
-   Shared design tokens and reusable components.

### Phase 2 --- Catalogue and discovery

-   Categories, products, search, product details.
-   Admin product/category management.
-   Inventory basics.
-   Customer home and category browsing.

### Phase 3 --- Cart, checkout and orders

-   Cart, address management and checkout.
-   Payment gateway integration.
-   Order creation, status history and admin order management.
-   Stock reservation and validation.

### Phase 4 --- Delivery operations

-   Delivery partner app.
-   Assignment and availability.
-   Pickup verification, location sharing and delivery OTP.
-   Customer order tracking and notifications.

### Phase 5 --- Support and business operations

-   Refunds, returns and support.
-   Promotions, reports and audit logs.
-   Homemade food availability and kitchen workflows.
-   Admin settings and advanced permissions.

### Phase 6 --- Quality and release readiness

-   Unit, integration, API and end-to-end testing.
-   Security and performance review.
-   UAT with admins, customers and delivery partners.
-   App store assets and release checklist.

Milestones should be re-estimated after team size, integrations, launch
scope and delivery date are confirmed.

## 20. Testing Strategy

-   Unit tests for pricing, coupon rules, permissions, inventory and
    state transitions.
-   Integration tests for database transactions, payment callbacks, OTP
    and notifications.
-   API tests for validation, authentication, authorization, pagination
    and idempotency.
-   End-to-end tests for signup/login, product purchase, order
    acceptance, rejection/refund, delivery OTP and cancellation.
-   Concurrency tests for simultaneous checkout and stock reservation.
-   Security tests for rate limits, session revocation, access control
    and input validation.
-   Device tests across agreed Android/iOS devices and network
    conditions.
-   Admin responsive and accessibility tests.
-   Payment sandbox tests and refund reconciliation tests.
-   Backup restoration and incident recovery exercises.

## 21. Dependencies and Decisions Required

Before development is locked, the product owner must confirm: 1. Initial
launch city/service areas and delivery radius. 2. Launch product
categories and whether all categories are available at launch. 3.
Whether homemade food sellers are VSR-managed kitchens or external
partners. 4. Whether guest browsing and guest checkout are allowed. 5.
Supported payment methods and selected gateway. 6. Whether cash on
delivery is allowed. 7. OTP/SMS/email providers and sender/domain setup.
8. Maps and live location provider. 9. Delivery fee, packaging fee, tax
and coupon policies. 10. Cancellation, return, replacement and refund
policies. 11. Delivery partner assignment rules and payout model. 12.
Food availability, cut-off times and food-specific policies. 13. Launch
languages and accessibility expectations. 14. Required reports and
export formats. 15. Data retention, privacy and account deletion
policies. 16. Launch date, team size, budget and release priorities.

## 22. Recommended Initial Release

For a controlled first launch, prioritize: - Customer authentication and
address management. - Product/category discovery and search. - Cart and
checkout. - Payment integration and accurate order state. - Admin
dashboard, orders, products, categories and inventory. - Delivery
assignment and delivery OTP. - Customer order history and
notifications. - Basic reports, audit logs and support.

Add advanced campaigns, loyalty, wallet, extensive analytics and
expanded homemade-food partner management after core order and delivery
operations are stable.

------------------------------------------------------------------------

**Document note:** This PRD defines intended product behavior and scope.
It excludes deployment and hosting instructions. It does not replace
detailed UI specifications, architecture diagrams, API contracts,
database validation rules, provider-specific integration guides, or
legal/compliance review.
