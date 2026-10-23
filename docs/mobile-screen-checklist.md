# Mobile app: screen-by-screen layout checklist

Layout refinement pass, 2026-10-23. The look stays the same (forest green, orange accent, cream / `#0B0B0C`). This pass changed spacing, alignment, hierarchy and states only.

**Legend**

- ✅ Done in code. `flutter analyze` is clean and `flutter test` passes.
- ☐ Still needs a check on a phone. Nothing in this pass was viewed on a device.
- — Not applicable to this screen.

## Shared rules every screen now follows

| Rule | Where it lives |
|---|---|
| 4-pt spacing scale with roles: gutter 16, section gap 28 above / 12 below a heading, group gap 12, row gap 8, nav clearance 120 | `VsrSpace` in `lib/core/theme.dart` |
| One radius set: controls 14, cards 18, sheets 24, small images 10 | `VsrRadius` in `lib/core/theme.dart` |
| App bar titles start-aligned on the 16px gutter (Android convention), 20px bold | `appBarTheme` |
| List rows share one indent; dividers start where the row text starts | `TileGroup` + `NavTile` in `lib/widgets/common.dart`, `listTileTheme` |
| Section headings: more space above than below | `SectionHeader` |
| Empty and error states: 72px icon, title, message, full-width action, max width 320; safe inside lists | `MessageView` / `ErrorView` |
| Loading uses a pulsing skeleton, not a spinner; respects reduce-motion | `LoadingView` |
| Full-page notices scroll on small phones or with large text; actions pinned at the bottom | `StatusScreen` |
| Pinned bottom buttons separated by a hairline, not a heavy shadow | `BottomCta` |

## Per-screen checklist

States columns: **Load** = skeleton, **Empty** = empty state, **Err** = error + offline + retry.

### Launch and system

| # | Screen | Route | What changed | Load | Empty | Err | Device check |
|---|---|---|---|---|---|---|---|
| 1 | Splash | `/splash` | Unchanged (animated WebP) | — | — | — | ☐ |
| 2 | App loading | `/loading` | Unchanged | ✅ | — | — | ☐ |
| 3 | Maintenance | `/gate/maintenance` | `StatusScreen`: scroll-safe, 32/12/24 rhythm, max text width 340 | — | — | ✅ | ☐ |
| 4 | Update required | `/gate/update` | Same as 3 | — | — | ✅ | ☐ |
| 5 | Unsupported version | `/gate/unsupported` | Same as 3 | — | — | ✅ | ☐ |
| 6 | Service unavailable | `/gate/unavailable` | Same as 3 | — | — | ✅ | ☐ |
| 7 | Onboarding | `/onboarding` | Gaps snapped to scale (≤2px shifts), reference look kept | — | — | — | ☐ |

### Login and sign-up (always light; matches your reference images)

| # | Screen | Route | What changed | Load | Empty | Err | Device check |
|---|---|---|---|---|---|---|---|
| 8 | Login entry | `/login` | Gaps snapped to scale; guest back button safe | ✅ busy | — | ✅ inline | ☐ |
| 9 | Password | `/login/password` | Gaps snapped to scale | ✅ busy | — | ✅ inline | ☐ |
| 10 | Login OTP | `/login/otp` | Gaps and info box padding snapped | ✅ busy | — | ✅ inline | ☐ |
| 11 | Create new password | `/login/new-password` | Gaps snapped | ✅ busy | — | ✅ inline | ☐ |
| 12 | Password updated | `/login/password-updated` | Gaps snapped | — | — | — | ☐ |
| 13 | Login success | `/auth/success` | Gaps snapped | — | — | — | ☐ |
| 14 | Sign up | `/signup` | Field gaps 14 → 16 | ✅ busy | — | ✅ | ☐ |
| 15 | Sign-up OTP | `/otp` | Gaps snapped | ✅ busy | — | ✅ | ☐ |
| 16 | Forgot password | `/forgot` | Gaps snapped | ✅ busy | — | ✅ | ☐ |

### Shopping

| # | Screen | Route | What changed | Load | Empty | Err | Device check |
|---|---|---|---|---|---|---|---|
| 17 | Home | `/` | Banner edges aligned to the gutter; banner subtitle fixed dark ink (was unreadable in dark mode); greeting promoted to title; quick links +24 top; category grid 12/16 gaps; search icon muted | ✅ | — | ✅ | ☐ |
| 18 | Categories | `/categories` | Card label left-aligned under image, 172px cells, 12 gaps, nav clearance | ✅ | ✅ | ✅ | ☐ |
| 19 | Product list | `/category/:id`, `/products` | Rows: 16 padding → 12 + 88px image; price and Add share the bottom row; low stock folded into the unit line; chips 56px rail | ✅ | ✅ | ✅ | ☐ |
| 20 | Product detail | `/product/:id` | Head reordered: name → unit → rating (tappable) → price → size → availability; one section rhythm (28 above, 8 below); allergen box tokenised | ✅ | ✅ unavailable | ✅ | ☐ |
| 21 | Gallery | `/gallery` | Thumbnail strip on the gutter, 12 vertical padding | — | — | — | ☐ |
| 22 | Reviews | `/product/:id/reviews` | Summary card 20 padding; distribution rows +1px; review cards 16 padding; gaps 12 | ✅ | ✅ | ✅ | ☐ |
| 23 | Write review | `/product/:id/review` | Centred product name; muted "Tap to rate"; 24 before the text field | ✅ | ✅ not eligible | ✅ | ☐ |
| 24 | Review success | `/review-success` | Via `StatusScreen` | — | — | — | ☐ |
| 25 | Search | `/search` | Gutter-aligned field; recent rows muted icon; popular chips 8 gaps; "1 result" grammar | ✅ | ✅ | ✅ | ☐ |
| 26 | Sort sheet | (sheet) | Title on the 20 sheet gutter | — | — | — | ☐ |
| 27 | Filter sheet | (sheet) | Section gaps 16 / 12, sheet gutter 20 | — | — | — | ☐ |
| 28 | Offers & Deals | `/deals` | Campaign cards radius 18 + 16 text inset; coupon strip skeleton; grid tokenised | ✅ | ✅ | ✅ | ☐ |
| 29 | Campaign | `/campaign` | Hero text +24 from bottom, subtitle full white for contrast; grid tokenised | ✅ | ✅ | ✅ | ☐ |
| 30 | Recommended | `/recommended` | Grid tokenised (276px tiles) | ✅ | ✅ | ✅ | ☐ |
| 31 | Recently viewed | `/recently-viewed` | Same as 30 | ✅ | ✅ | ✅ | ☐ |

### Cart and checkout

| # | Screen | Route | What changed | Load | Empty | Err | Device check |
|---|---|---|---|---|---|---|---|
| 32 | Cart | `/cart` | Rows 16 padding; line total bold with "₹x each"; stepper moved onto the price row; dividers start at item text; coupon row in a `TileGroup`; "Total" label above the amount | ✅ | ✅ | ✅ | ☐ |
| 33 | Coupon sheet | (sheet) | 20 gutter; Apply button matches field height | ✅ | — | — | ☐ |
| 34 | Select address | `/checkout/address` | Cards radius 18, 16 padding, 40px icon tile; branded "Add" button; 12 gaps | ✅ | ✅ | ✅ | ☐ |
| 35 | Payment | `/checkout/payment` | Section 24 / 12; dividers on text; gap before the bill; lock icon top-aligned | — | — | ✅ | ☐ |
| 36 | Order success | `/order-success/:id` | Order number as a pill; 32 / 16 rhythm | — | — | — | ☐ |

### Orders

| # | Screen | Route | What changed | Load | Empty | Err | Device check |
|---|---|---|---|---|---|---|---|
| 37 | My orders | `/orders` | Card: number + total on one line, date · item count, status + chevron row; 16 padding; guest state | ✅ | ✅ | ✅ | ☐ |
| 38 | Order details | `/orders/:id` | All cards 16 padding; delivery code box 20 padding and 4px rhythm; address + payment merged into one group; actions ordered primary → reorder → cancel → help | ✅ | — | ✅ | ☐ |
| 39 | Cancel sheet | (sheet) | Subtitle added; 20 gutter; 16 before the button | — | — | — | ☐ |
| 40 | Rate order | `/orders/:id/rate` | Centred heading + subtitle; 24 rhythm | — | — | ✅ | ☐ |

### Profile and account

| # | Screen | Route | What changed | Load | Empty | Err | Device check |
|---|---|---|---|---|---|---|---|
| 41 | Profile | `/profile` | Identity on the page (no card); guest gets a full-width Log in; groups "Your account" / "Support & app"; Log out moved into its own danger row | — | ✅ guest | — | ☐ |
| 42 | Edit profile | `/profile/edit` | Field gaps 16 | — | — | ✅ | ☐ |
| 43 | Addresses | `/addresses` | Same as 34 | ✅ | ✅ | ✅ | ☐ |
| 44 | Address form | `/address/new`, `/address/:id` | "Save address as" label; fields 16 apart; 24 after segments | ✅ busy | — | ✅ | ☐ |
| 45 | Wishlist | `/wishlist` | Grid tokenised | ✅ | ✅ | ✅ | ☐ |
| 46 | Offers & coupons | `/offers` | Coupon card: icon tile, value + min order, code chip right-aligned | ✅ | ✅ | ✅ | ☐ |
| 47 | Notifications | `/notifications` | Custom card: title + unread dot, two-line body, time below; 16 padding | ✅ | ✅ | ✅ | ☐ |
| 48 | Notification detail | `/notifications/:id` | 24 / 12 / 32 rhythm | — | — | — | ☐ |
| 49 | Help & Support | `/help` | Groups "Get in touch" / "Common questions" / "My tickets"; FAQ tiles borderless inside the group; tickets empty text in the group | ✅ | ✅ | ✅ | ☐ |
| 50 | Ticket sheet | (sheet) | 20 gutter; 24 / 16 / 8 field rhythm | ✅ busy | — | ✅ | ☐ |
| 51 | Settings & legal (More) | `/more` | Groups "Appearance" / "Legal"; account deletion in its own danger row | — | — | ✅ | ☐ |

### Location

| # | Screen | Route | What changed | Load | Empty | Err | Device check |
|---|---|---|---|---|---|---|---|
| 52 | Choose location | `/location` | Options in a `TileGroup`; saved addresses group with an empty message inside | ✅ | ✅ | ✅ | ☐ |
| 53 | Location permission | `/location/permission` | Benefit rows 8 / 12 | — | — | — | ☐ |
| 54 | Location search | `/location/search` | Gutter-aligned field; results wrap to 2 lines | ✅ | — | ✅ | ☐ |
| 55 | Map pick | `/location/map` | Bottom panel rounded 24, 24 top padding, 20 gutter | ✅ | — | ✅ | ☐ |
| 56 | Not serviceable | `/location/not-serviceable` | Via `StatusScreen` | — | — | — | ☐ |
| 57 | Location unavailable | `/location/unavailable` | Via `StatusScreen` | — | — | — | ☐ |
| 58 | Location denied | `/location/denied` | Via `StatusScreen` | — | — | — | ☐ |

### App shell

| # | Screen | Route | What changed | Load | Empty | Err | Device check |
|---|---|---|---|---|---|---|---|
| 59 | Bottom nav + cart bar | (shell) | Smaller cart bar; hides the nav on scroll down and shows the compact cart in its place; back on a non-Home tab goes Home | — | — | — | ☐ |

## How to verify on a device (do this once, all at once)

1. Rebuild: `tool\dev.ps1` (a hot reload isn't enough).
2. Walk every row above in **Light**, then **Dark** (Profile → Settings & legal → Appearance).
3. Repeat Home, Product detail, Cart and Order details with the phone's **largest font size**.
4. Turn on airplane mode and open Home, Orders and Wishlist. Each should show the offline state with Retry.
5. Log out, tap **Guest**, and open every bottom tab.

Tick the ☐ boxes as you go. Anything that looks off: send a screenshot with the row number.
