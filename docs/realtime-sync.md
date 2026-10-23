# Realtime sync (WebSocket)

Every committed database write reaches every open admin page and mobile screen that shows that data, with no refresh.

## How it works

1. **Backend:** `backend/src/realtime.ts` opens one MongoDB change stream on the database. Change streams report only committed writes, so transactions such as order accept or stock reserve are never seen half-done. Every route, webhook, seed and script is covered, with no per-route code.
2. For each change, the backend emits `change` with `{ coll, op, id }` over Socket.IO, to the right rooms only. No document data is sent.
3. **Clients:** each client maps the collection to the screens or queries that show it, and refetches them through the normal authenticated REST API. Events are batched for 250ms, so a burst of writes causes one refetch.
4. **Reconnects:** after a dropped connection, clients refetch everything visible, which covers any events missed while offline.

## Rooms (who receives what)

| Room | Joined by | Receives |
|---|---|---|
| `public` | everyone, including guests with no token | products, categories, banners, coupons, reviews, homelayouts |
| `user:<id>` | the signed-in customer | their stock alerts, orders, payments, cart, tickets, notifications, user doc (addresses, wishlist, profile) |
| `customers` | every signed-in customer | broadcast notifications (`audience: all_customers`) |
| `staff` | any staff role | everything below, plus all of the above |

Staff-only collections: auditlogs, inventorymovements, kitchens, deliverypartners, refunds, users (all).
Ignored collections: sessions, otps, counters.

A socket authenticates with the same JWT access token as the API (`auth.token` in the handshake). It rejoins with a fresh token whenever the session changes (login, logout, token refresh).

## Collection → what refreshes

| Collection | Admin web (TanStack Query key prefixes) | Mobile (Riverpod providers) |
|---|---|---|
| products | products, product, inventory-overview, movements, dashboard, search | home, products, productDetail, deals, search, recentlyViewed, recommendations, wishlist, cart |
| categories | categories, cats-root, cats-sub, products, dashboard | categories, home |
| inventorymovements | movements, inventory-overview, products, product | — |
| reviews | reviews, product | productDetail, reviews |
| orders | orders, order, order-counts, dashboard, customers, customer, reports, partners, payments | orders, order |
| payments, refunds | payments, payment, order, orders, dashboard, reports | orders, order |
| carts | — | cart |
| stockalerts | — | stock-alerts (web) / stockAlerts (app) |
| users | customers, customer, customer-insights, staff | addresses, wishlist |
| deliverypartners | partners, order | order |
| banners | banners | home |
| homelayouts (Home Screen editor, category Home switch) | home-layout | home, recommendations (web storefront: home, recommended) |
| coupons | coupons, banners | coupons, cart |
| supporttickets | support, ticket, customer | tickets |
| notifications | admin-notifications, bell | notifications |
| auditlogs | audit | — |
| kitchens | kitchens, products | — |

## Requirements and failure modes

- Change streams need a replica set. Atlas and the dev in-memory replset both are one. On a standalone `mongod` the stream fails to open: the API logs one warning and keeps working without live updates.
- Behind a proxy, WebSocket upgrade must be allowed on `/socket.io` (the Vite dev proxy does this).
- The admin bell keeps its 60s poll as a safety net.
