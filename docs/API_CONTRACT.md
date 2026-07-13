# Oxtore — API Contract

> Generated: 2026-07-13
> Version: 2.0.0 (supersedes 1.0.0 / 2026-06-24)
> Scope: Every mock data surface in `apps/oxtore-mobile` + `libs/shared/*`, re-audited against current code.

This document is the single source of truth for the backend team building the real API. It lists **every endpoint the frontend needs**, grouped by domain, with request/response shapes, auth requirements, and the exact TypeScript models the frontend already expects. It also flags mock-data quirks that must **not** be replicated in the real API.

---

## Table of Contents

1. [How the app works today](#1-how-the-app-works-today)
2. [Domain Models (canonical)](#2-domain-models-canonical)
3. [Auth & Authorization](#3-auth--authorization)
4. [Endpoints — Auth](#4-endpoints--auth)
5. [Endpoints — Users / Profile / Settings](#5-endpoints--users--profile--settings)
6. [Endpoints — Boutiques](#6-endpoints--boutiques)
7. [Endpoints — Products (catalog + creation)](#7-endpoints--products-catalog--creation)
8. [Endpoints — Sales](#8-endpoints--sales)
9. [Endpoints — Stock](#9-endpoints--stock)
10. [Endpoints — Stock Requests (inter-boutique supply)](#10-endpoints--stock-requests-inter-boutique-supply)
11. [Endpoints — Boutique Network (partnerships)](#11-endpoints--boutique-network-partnerships)
12. [Endpoints — HR / Employees](#12-endpoints--hr--employees)
13. [Endpoints — Marketplace (buyer-facing)](#13-endpoints--marketplace-buyer-facing)
14. [Endpoints — Feed](#14-endpoints--feed)
15. [Endpoints — Cart / Checkout / Orders](#15-endpoints--cart--checkout--orders)
16. [Endpoints — Wallet](#16-endpoints--wallet)
17. [Endpoints — Notifications](#17-endpoints--notifications)
18. [Endpoints — Admin](#18-endpoints--admin)
19. [Endpoints — Config](#19-endpoints--config)
20. [External API — Geolocation reverse-geocode](#20-external-api--geolocation-reverse-geocode)
21. [Route ↔ Guard ↔ Data map](#21-route--guard--data-map)
22. [Mock-data quirks to NOT replicate](#22-mock-data-quirks-to-not-replicate)
23. [Migration checklist](#23-migration-checklist)

---

## 1. How the app works today

Every "API call" in the app is `HttpClient.get()` against a static file in `apps/oxtore-mobile/src/assets/mock-data/*.json`, cached in an Angular signal. Every create/update/delete method mutates that in-memory signal and returns `of(...)` — **no real network write happens anywhere in the app today.** The endpoint paths below are what each mock call must become.

Central endpoint map (frontend): `libs/shared/data-access/src/lib/constants/api-endpoints.constants.ts`. When the real API is ready, this is the **only file** that needs its values changed from `/assets/mock-data/*.json` to real URLs (plus an `environment.apiBaseUrl` prefix — see [§23](#23-migration-checklist)).

The **only genuinely external HTTP call today** is reverse-geocoding for country auto-detection ([§20](#20-external-api--geolocation-reverse-geocode)) — everything else is local mock JSON.

---

## 2. Domain Models (canonical)

These are the actual TypeScript interfaces the frontend consumes (`libs/shared/data-access/src/lib/models/*.ts`). The real API's JSON responses must match these field names and types exactly, or the frontend needs updating in lockstep.

```typescript
// ── Enums ──────────────────────────────────────────────────────────────────
type UserRole = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'SELLER' | 'USER';
type AssignableRole = 'MANAGER' | 'SUPERVISOR' | 'SELLER';
type BoutiqueRelationType = 'RESELLER';
type BoutiqueRelationStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
type BoutiqueRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
type StockRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED';
type ProductCondition = 'new' | 'used';
type SaleType = 'wholesale' | 'retail' | 'both';
type TransactionMode = 'consignment' | 'direct' | 'commission';
type ProductVisibility = 'public' | 'private';
type ProductApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
type ProductStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
type CommissionActor = 'seller' | 'supervisor' | 'manager';
type CommissionType = 'percentage' | 'fixed';
type NotificationType = 'sale' | 'commission' | 'stock' | 'hr' | 'system' | 'network' | 'stock_request';
type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'profit' | 'fee';
type MarketplaceCondition = 'NEW' | 'USED';
type MarketplaceSaleType = 'RETAIL' | 'WHOLESALE';

// ── User ─────────────────────────────────────────────────────────────────
interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar?: string;
  role: UserRole;
  ownedBoutiqueIds: string[];
  activeBoutiqueId?: string | null;
  permissions: string[];
  isVerified: boolean;
  createdAt: string; // ISO
}

// ── Boutique ─────────────────────────────────────────────────────────────
interface Boutique {
  id: string;
  name: string;
  logo?: string;
  address: string;
  phone: string;
  description: string;
  ownerIds: string[];
  managerId: string;
  managerName: string;
  status: 'active' | 'pending' | 'suspended';
  language: string;
  currency: string;
  categories: string[];
  employeeCount: number;
  productCount: number;
  revenue: number;
  createdAt: string;
}

interface BoutiqueRelation {
  id: string;
  fromBoutiqueId: string;
  toBoutiqueId: string;
  type: BoutiqueRelationType;
  status: BoutiqueRelationStatus;
  description?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
}

interface BoutiqueRequest {
  id: string;
  fromBoutiqueId: string;
  fromBoutiqueName: string;
  toBoutiqueId: string;
  toBoutiqueName: string;
  type: BoutiqueRelationType;
  status: BoutiqueRequestStatus;
  message?: string;
  rejectionReason?: string;
  createdAt: string;
  respondedAt?: string | null;
  respondedBy?: string | null;
}

// ── Employee ─────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar?: string;
  role: UserRole;
  boutiqueId: string;
  boutiqueName: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
}

// ── Product ──────────────────────────────────────────────────────────────
interface CommissionRule { actor: CommissionActor; type: CommissionType; value: number | null; }
interface SaleCommission { actor: CommissionActor; type: CommissionType; value: number; amount: number; }
interface WholesaleTier { minQty: number; unitPrice: number; }
interface ProductInventory { quantity: number; available: number; safetyStock: number; reorderLevel: number; status: ProductStockStatus; }
interface ProductPricing { purchasePrice: number; sellingPrice: number; wholesalePrice: number; }

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;                 // ⚠ mock JSON currently uses `categoryId` — see §22
  brand: string;
  description: string;
  images: string[];
  ownerBoutiqueId: string;
  createdBy: string;
  isPublic: boolean;
  visibility: ProductVisibility;     // deprecated, prefer isPublic
  published: boolean;
  publishedAt?: string;
  saleTypes: ('retail' | 'wholesale')[];
  wholesaleEnabled: boolean;
  consignmentEnabled: boolean;
  inventory: ProductInventory;
  pricing: ProductPricing;
  wholesaleTiers: WholesaleTier[];
  saleType: SaleType;
  transactionMode: TransactionMode;
  condition: ProductCondition;
  commissions: CommissionRule[];
  approvalStatus: ProductApprovalStatus;
  status: 'published' | 'draft' | 'archived';
  createdAt: string;
  updatedAt?: string;
}

// ── Sale ─────────────────────────────────────────────────────────────────
interface Sale {
  id: string;
  productId: string;
  productName: string;
  boutiqueId: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  commissions: SaleCommission[];
  netAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

// ── Stock ────────────────────────────────────────────────────────────────
interface StockMovement { type: 'in' | 'out' | 'adj'; qty: number; note: string; date: string; }

interface StockItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  boutiqueId: string;
  quantity: number;
  available: number;
  reserved: number;
  safetyStock: number;
  reorderLevel: number;
  status: ProductStockStatus;
  lastUpdated: string;
  movements: StockMovement[];
}

interface StockRequest {
  id: string;
  fromBoutiqueId: string;
  fromBoutiqueName: string;
  toBoutiqueId: string;
  toBoutiqueName: string;
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  message?: string;
  rejectionReason?: string;
  status: StockRequestStatus;
  createdAt: string;
  respondedAt?: string | null;
  respondedBy?: string | null;
  fulfilledAt?: string | null;
}

// ── Notification ─────────────────────────────────────────────────────────
interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  icon: string;
  read: boolean;
  meta?: Record<string, string>;
  createdAt: string;
}

// ── Config ───────────────────────────────────────────────────────────────
interface Currency { code: string; label: string; symbol: string; deliveryFee: number; }

interface Country {
  code: string; flag: string; dialCode: string; name: string;
  pattern: RegExp; currency: string; language: 'en' | 'fr' | 'ar';
}
interface DetectedCountry {
  country: string; iso: string; currency: string;
  phoneCode: string; flag: string; language: 'en' | 'fr' | 'ar';
}

// ── Cart / Orders ────────────────────────────────────────────────────────
interface CartProduct {
  productId: string; name: string; price: number; image: string;
  quantity: number; condition?: string; saleType?: string;
}

interface Order {
  id: string;
  reference: string;
  productName: string;
  productImage: string;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  seller: string;
}

// ── Wallet ───────────────────────────────────────────────────────────────
interface WalletTransaction { id: string; type: TransactionType; label: string; date: string; amount: number; currency: string; }
interface WalletBalance { total: number; available: number; margin: number; blocked: number; currency: string; monthlyGain: number; monthlyGainPercent: number; }
interface WalletData { balance: WalletBalance; transactions: WalletTransaction[]; }

// ── Admin ────────────────────────────────────────────────────────────────
interface AdminStat { key: string; label: string; value: string; icon: string; colorClass: string; trend: string; trendColorClass: string; }

// ── Marketplace / Feed (buyer-facing) ────────────────────────────────────
interface MarketplaceProduct {
  id: string; name: string; price: number; image: string; category: string;
  condition: MarketplaceCondition; saleType: MarketplaceSaleType;
  transactionMode: 'direct' | 'consignment'; description: string;
  stock: number; boutique: string; boutiqueId: string;
}
interface MarketplaceCategory { id: string; name: string; icon: string; }
interface FeedProduct {
  id: string; name: string; price: number; image: string;
  boutiqueName: string; boutiqueAvatar: string; category: string;
  likes: number; liked: boolean; condition: MarketplaceCondition;
}

// ── User Settings ────────────────────────────────────────────────────────
interface UserSettings { notifications: boolean; darkMode: boolean; language: 'en' | 'fr' | 'ar'; currency: string; }
```

---

## 3. Auth & Authorization

- **Token**: real signed JWT (`Authorization: Bearer {token}` on every authenticated request). The current mock token is a **non-standard double-base64-encoded** string — do not replicate; issue a standard JWT with at least `sub` (user id), `role`, `iat`, `exp` claims.
- **Session storage (frontend)**: token + user cached in `localStorage` (`oxtore_jwt`, `oxtore_user`) purely for offline/instant-resume; the backend is the source of truth for validity (expiry, revocation).
- **Roles**: `ADMIN`, `MANAGER`, `SUPERVISOR`, `SELLER`, `USER`. Route-level role gates already exist in the frontend (`RoleGuard`) — see [§21](#21-route--guard--data-map) for exactly which roles each endpoint's UI requires. The backend must enforce the same rules server-side (never trust the client-side guard alone).
- **Permissions array**: `User.permissions: string[]` exists in the model (e.g. `"read:all"`, `"write:products"`, `"manage:hr"`) but is not currently checked anywhere in the frontend beyond being stored — reserved for future fine-grained authorization; role is what's actually enforced today.

---

## 4. Endpoints — Auth

#### `POST /api/auth/login`
```
Body:     { email: string; password: string }
Response: { user: User; token: string }
Errors:   401 invalid credentials
```

#### `POST /api/auth/signup`
```
Body:     { fullName: string; email: string; phone: string; password: string; avatar?: string }
Response: { message: string; email: string }   // triggers OTP send server-side
Errors:   409 email already exists; 422 validation
```

#### `POST /api/auth/otp/send`
```
Body:     { email: string; method: 'email' | 'whatsapp' }
Response: { expiresIn: number }
```

#### `POST /api/auth/otp/verify`
```
Body:     { email: string; code: string }
Response: { user: User; token: string }
Errors:   400 invalid/expired code
```

#### `POST /api/auth/otp/resend`
```
Body:     { email: string }
Response: { expiresIn: number }
```

#### `POST /api/auth/google`
```
Body:     { idToken: string }                  // real Google OAuth ID token — current impl is 100% mocked, returns a hardcoded user
Response: { user: User; token: string; needsPhone: boolean }
```

#### `POST /api/auth/complete-profile`
```
Auth:     Bearer (partially-authenticated session from Google flow)
Body:     { phone: string }
Response: { user: User; token: string }
```

#### `POST /api/auth/forgot-password`
```
Body:     { email: string }
Response: { message: string }
```

#### `POST /api/auth/logout`
```
Auth: Bearer
Response: 204
```

---

## 5. Endpoints — Users / Profile / Settings

#### `GET /api/users/me`
```
Auth: Bearer
Response: User
```
Replaces the current `UserResolver` fallback to `localStorage`.

#### `PATCH /api/users/:userId`
```
Auth: Bearer (self or ADMIN)
Body: Partial<User>                            // used by edit-profile page (name/email/phone/avatar)
Response: User
```

#### `GET /api/users/:userId/settings`
```
Auth: Bearer
Response: UserSettings
```

#### `PATCH /api/users/:userId/settings`
```
Auth: Bearer
Body: Partial<UserSettings>
Response: UserSettings
```

#### `GET /api/users/:userId/stats`
```
Auth: Bearer
Response: { ordersCount: number; wishlistCount: number; rating: number }
```
New — currently the Profile page hardcodes "4 orders / 12 wishlist / 4.8 rating".

---

## 6. Endpoints — Boutiques

#### `GET /api/boutiques`
```
Auth: Bearer
Query: ownerId?, managerId?
Response: Boutique[]
```

#### `GET /api/boutiques/discoverable`
```
Auth: Bearer
Query: excludeUserId (boutiques the user does not already own/manage)
Response: Boutique[]
```
Backs the "find partners" list in Boutique Network.

#### `GET /api/boutiques/:id`
```
Response: Boutique
```

#### `POST /api/boutiques`
```
Auth: Bearer
Body: Omit<Boutique, 'id' | 'createdAt' | 'employeeCount' | 'productCount' | 'revenue'>
Response: Boutique
```

#### `PATCH /api/boutiques/:id`
```
Auth: Bearer (owner/manager or ADMIN)
Body: Partial<Boutique>
Response: Boutique
```

#### `DELETE /api/boutiques/:id`
```
Auth: Bearer (owner or ADMIN)
Response: 204
```

---

## 7. Endpoints — Products (catalog + creation)

#### `GET /api/boutiques/:boutiqueId/products`
```
Auth: Bearer
Query: status?, category?
Response: Product[]
```

#### `GET /api/products/:id`
```
Response: Product
```

#### `POST /api/boutiques/:boutiqueId/products`
```
Auth: Bearer
Body: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>   // built by the Article Creation wizard
Response: Product
```
This is the real endpoint behind the multi-step Article Creation flow (`article-creation.page.ts`), which already assembles the full payload client-side (SKU auto-gen, `saleTypes`, `wholesaleEnabled`, `consignmentEnabled`, `inventory`, `pricing`, `wholesaleTiers`, `commissions`, `approvalStatus`, `status`) — the backend just needs to persist it and return the created record.

#### `PATCH /api/products/:id`
```
Auth: Bearer
Body: Partial<Product>
Response: Product
```

#### `PATCH /api/products/:id/stock`
```
Auth: Bearer
Body: { quantitySold: number }        // decrements inventory, recomputes ProductStockStatus
Response: Product
```

#### `DELETE /api/products/:id`
```
Auth: Bearer
Response: 204
```

---

## 8. Endpoints — Sales

#### `GET /api/boutiques/:boutiqueId/sales`
```
Auth: Bearer
Query: sellerId?, status?, from?, to?
Response: { data: Sale[]; meta: { total: number; revenue: number } }
```

#### `POST /api/boutiques/:boutiqueId/sales`
```
Auth: Bearer
Body: { productId: string; quantity: number; unitPrice: number; sellerId: string }
Response: Sale
```
Recording a sale must also, server-side: decrement product stock (equivalent of `PATCH /products/:id/stock`) and append a `StockMovement` — both currently happen client-side across two separate mock services and need to become one transactional backend operation.

#### `PATCH /api/sales/:id`
```
Auth: Bearer
Body: Partial<Sale>                   // e.g. status: 'confirmed' | 'cancelled'
Response: Sale
```

#### `GET /api/boutiques/:boutiqueId/sales/commissions`
```
Auth: Bearer
Query: sellerId?
Response: { sellerId: string; total: number }[]
```

---

## 9. Endpoints — Stock

#### `GET /api/boutiques/:boutiqueId/stock`
```
Auth: Bearer
Query: status?, productId?
Response: StockItem[]
```

#### `POST /api/stock/:productId/movements`
```
Auth: Bearer
Body: { type: 'in' | 'out' | 'adj'; qty: number; note?: string }
Response: StockItem                   // recomputed quantity/available/status
```

#### `PATCH /api/stock/:id`
```
Auth: Bearer
Body: Partial<StockItem>
Response: StockItem
```

---

## 10. Endpoints — Stock Requests (inter-boutique supply)

Used by `network-products.page.ts` (raise a request against a partner's stock) and `stock-requests.page.ts` (manage sent/received requests).

#### `GET /api/stock-requests`
```
Auth: Bearer
Query: boutiqueIds (sent-by or received-by, comma-separated)
Response: StockRequest[]
```

#### `GET /api/stock-requests/:id`
```
Response: StockRequest
```

#### `POST /api/stock-requests`
```
Auth: Bearer
Body: { toBoutiqueId: string; productId: string; quantity: number; message?: string }
Response: StockRequest                // status: 'PENDING'; also creates a Notification for the receiving boutique's owner
```

#### `PATCH /api/stock-requests/:id/approve`
```
Auth: Bearer (receiving boutique owner/manager)
Response: StockRequest                // status: 'APPROVED'
```

#### `PATCH /api/stock-requests/:id/reject`
```
Auth: Bearer
Body: { rejectionReason?: string }
Response: StockRequest                // status: 'REJECTED'; notifies requester
```

#### `PATCH /api/stock-requests/:id/fulfill`
```
Auth: Bearer
Response: StockRequest                // status: 'FULFILLED'; must also post a StockMovement + Notification (currently done client-side across 2 services — needs to be one transactional backend call)
```

---

## 11. Endpoints — Boutique Network (partnerships)

Used by `boutique-network.page.ts`. Two related resources: **relations** (an established partnership) and **requests** (a pending ask to form one).

#### `GET /api/boutique-relations`
```
Auth: Bearer
Query: boutiqueId
Response: BoutiqueRelation[]
```

#### `POST /api/boutique-relations`
```
Auth: Bearer
Body: { fromBoutiqueId: string; toBoutiqueId: string; type: 'RESELLER'; approvedBy: string }
Response: BoutiqueRelation
```
(Typically created as a side-effect of accepting a `BoutiqueRequest`, not called directly by the UI — kept as its own endpoint for admin/backfill use.)

#### `PATCH /api/boutique-relations/:id`
```
Auth: Bearer
Body: { status: BoutiqueRelationStatus }
Response: BoutiqueRelation
```

#### `GET /api/boutique-requests`
```
Auth: Bearer
Query: boutiqueIds (sent-by or received-by, comma-separated)
Response: BoutiqueRequest[]
```

#### `POST /api/boutique-requests`
```
Auth: Bearer
Body: { fromBoutiqueId: string; toBoutiqueId: string; type: 'RESELLER'; message?: string }
Response: BoutiqueRequest             // status: 'PENDING'; notifies target boutique owner
```

#### `PATCH /api/boutique-requests/:id/accept`
```
Auth: Bearer
Body: { respondedBy: string }
Response: BoutiqueRequest             // status: 'ACCEPTED'; server must ALSO create a BoutiqueRelation + Notification atomically
```

#### `PATCH /api/boutique-requests/:id/reject`
```
Auth: Bearer
Body: { respondedBy: string; rejectionReason?: string }
Response: BoutiqueRequest             // status: 'REJECTED'; notifies requester
```

#### `GET /api/boutiques/:id/network-products`
```
Auth: Bearer
Response: Product[]                   // products sourceable from approved reseller partners, with visibility rules (isPublic + relation status) already applied server-side
```
Replaces the client-side `isProductVisibleToBoutique` / `filterVisiblePartnerProducts` / `getSourceableProducts` business logic in `BoutiqueNetworkService` — this filtering should move server-side.

---

## 12. Endpoints — HR / Employees

#### `GET /api/boutiques/:boutiqueId/employees`
```
Auth: Bearer
Query: role?, status?
Response: Employee[]
```

#### `GET /api/employees/:id`
```
Response: Employee
```

#### `POST /api/boutiques/:boutiqueId/employees`
```
Auth: Bearer (ADMIN, MANAGER)
Body: { fullName: string; email: string; phone: string; role: AssignableRole; avatar?: string }
Response: Employee
```

#### `PATCH /api/employees/:id`
```
Auth: Bearer (ADMIN, MANAGER)
Body: Partial<Employee>
Response: Employee
```

#### `PATCH /api/employees/:id/role`
```
Auth: Bearer (ADMIN, MANAGER)
Body: { role: AssignableRole }
Response: Employee
```

#### `PATCH /api/employees/:id/status`
```
Auth: Bearer
Body: { status: 'active' | 'inactive' | 'pending' }
Response: Employee
```

#### `DELETE /api/employees/:id`
```
Auth: Bearer (ADMIN, MANAGER)
Response: 204
```

---

## 13. Endpoints — Marketplace (buyer-facing)

#### `GET /api/marketplace/products`
```
Query: category?, condition?('NEW'|'USED'), saleType?('RETAIL'|'WHOLESALE'), q?, page?(default 1), limit?(default 20)
Response: { data: MarketplaceProduct[]; meta: { total: number; page: number; limit: number } }
```

#### `GET /api/marketplace/products/:id`
```
Response: MarketplaceProduct
Errors:   404
```

#### `GET /api/marketplace/categories`
```
Response: MarketplaceCategory[]
```
Note: category `name` (English display label) and product `category` (French slug, e.g. `"automobile"`) currently don't line up 1:1 in the mock data — the real API should key both by the same stable category `id`/slug.

---

## 14. Endpoints — Feed

#### `GET /api/feed`
```
Query: cursor?, limit?(default 10)
Response: { data: FeedProduct[]; nextCursor?: string }
```

#### `POST /api/feed/products/:id/like`
```
Auth: Bearer
Response: { liked: boolean; likes: number }
```
`liked` must be computed per-requesting-user server-side — today it's a static hardcoded flag in the mock JSON, not user-specific.

---

## 15. Endpoints — Cart / Checkout / Orders

Cart itself (`CartService`) is pure client-side state (items, quantities, currency) — no endpoint needed for that. But **there is currently no checkout/order-creation endpoint at all**: `orders.json` is read-only mock data, and nothing in the app converts a cart into an order. This is a real functional gap, not just a migration item.

#### `POST /api/orders` — **NEW, required for checkout to actually work**
```
Auth: Bearer
Body: { items: { productId: string; quantity: number }[]; currency: string }
Response: Order
Errors:   409 out-of-stock item(s)
```

#### `GET /api/users/:userId/orders`
```
Auth: Bearer
Query: status?, page?
Response: { data: Order[]; meta: { total: number } }
```

#### `GET /api/users/:userId/orders/:orderId`
```
Auth: Bearer
Response: Order
```

---

## 16. Endpoints — Wallet

Read-only today — no transfer/deposit/withdraw UI exists yet, so only GET is currently required, but the model already anticipates transactions.

#### `GET /api/users/:userId/wallet`
```
Auth: Bearer
Response: WalletData
```

#### `GET /api/users/:userId/wallet/transactions`
```
Auth: Bearer
Query: type?, page?
Response: { data: WalletTransaction[]; meta: { total: number } }
```

#### `POST /api/users/:userId/wallet/transfer` — reserved, no frontend caller yet
```
Auth: Bearer
Body: { amount: number; targetUserId: string; note?: string }
Response: WalletTransaction
```

---

## 17. Endpoints — Notifications

#### `GET /api/users/:userId/notifications`
```
Auth: Bearer
Query: unread?(boolean), page?
Response: { data: Notification[]; meta: { unread: number; total: number } }
```

#### `PATCH /api/notifications/:id/read`
```
Auth: Bearer
Response: Notification
```

#### `PATCH /api/users/:userId/notifications/read-all`
```
Auth: Bearer
Response: 204
```

Server-triggered notification creation (not a frontend-called endpoint, but backend must emit these as side effects): new stock request received, stock request approved/rejected/fulfilled, partnership request received, partnership request accepted/rejected, sale recorded, low-stock alert.

---

## 18. Endpoints — Admin

#### `GET /api/admin/stats`
```
Auth: Bearer, Role: ADMIN
Response: AdminStat[]
```
Note: `value` is currently a pre-formatted display string (e.g. `"2,847"`) in the mock — recommend the real API return a raw `number` and let the frontend format it, but keep the field as `value: string` for now to avoid a breaking frontend change unless you coordinate the switch.

#### `GET /api/admin/users` — reserved, no frontend caller yet
```
Auth: Bearer, Role: ADMIN
Query: role?, page?, limit?
Response: { data: User[]; meta: { total: number } }
```

---

## 19. Endpoints — Config

#### `GET /api/config/currencies`
```
Response: Currency[]
```

---

## 20. External API — Geolocation reverse-geocode

This one already works against a **real third-party service**, not mock data — used by `CountryService` (`libs/shared/state/src/lib/country.service.ts`) for automatic country/currency/language detection on first launch.

```
GET https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={lat}&longitude={lng}&localityLanguage=en
Auth:    none (free, keyless)
Response fields consumed: { countryCode: string; countryName: string }  (response has more fields; only these two are read)
```

**Recommendation for production**: proxy this through your own backend (`GET /api/geo/reverse-geocode?lat=&lng=`) rather than calling BigDataCloud directly from the client — keeps a stable contract if you later switch geocoding providers, and lets you rate-limit/cache server-side. The frontend only needs `{ countryCode, countryName }` back, so the proxy can wrap any provider.

---

## 21. Route ↔ Guard ↔ Data map

| Route | Guard | Required role(s) | Resolver / primary data |
|---|---|---|---|
| `/login`, `/signup`, `/forgot-password` | — | public | — |
| `/verify-otp` | — (⚠ recommend adding a pending-OTP guard) | public | — |
| `/complete-phone` | — (⚠ recommend adding a pending-profile guard) | public | — |
| `/article-creation` | AuthGuard | any authenticated | — |
| `/tabs` (shell) | AuthGuard | any authenticated | — |
| `/tabs/feed` | — | any authenticated | `FeedService` |
| `/tabs/home` (marketplace) | — | any authenticated | `MarketplaceService` |
| `/tabs/cart` | — | any authenticated | `CartService` (client-only) |
| `/tabs/profile` | — | any authenticated | `UserResolver`, `SettingsResolver` |
| `/tabs/edit-profile` | — | any authenticated | `UserResolver` |
| `/tabs/orders` | — | any authenticated | `OrdersResolver` |
| `/tabs/boutiques` | — | any authenticated | `BoutiquesApiService` |
| `/tabs/dashboard` | AuthGuard | any authenticated | store/services (no resolver) |
| `/tabs/boutique-settings` | AuthGuard | any authenticated | — |
| `/tabs/boutique-network` | AuthGuard | any authenticated | `BoutiqueNetworkService` |
| `/tabs/boutique-detail/:id` | AuthGuard | any authenticated | `BoutiquesApiService` |
| `/tabs/network-products` | RoleGuard | ADMIN, MANAGER | `BoutiqueNetworkService` |
| `/tabs/stock-requests` | RoleGuard | ADMIN, MANAGER | `StockRequestsApiService` |
| `/tabs/make-sale` | RoleGuard | ADMIN, MANAGER, SUPERVISOR, SELLER | `ProductsApiService` |
| `/tabs/sales-history` | RoleGuard | ADMIN, MANAGER, SUPERVISOR, SELLER | `SalesApiService` |
| `/tabs/stock` | RoleGuard | ADMIN, MANAGER, SUPERVISOR | `StockApiService` |
| `/tabs/hr` | RoleGuard | ADMIN, MANAGER | `HrApiService` |
| `/tabs/admin` | RoleGuard | ADMIN | `AdminResolver` |

---

## 22. Mock-data quirks to NOT replicate

These are bugs/inconsistencies in the current mock layer — the real API should follow the canonical model in [§2](#2-domain-models-canonical), not these:

1. **`products.json` uses `categoryId`**, but the `Product` model field is `category`. Pick one (`category`) and rename consistently.
2. **`ProductsApiService.getAll(boutiqueId)` filters on `p.boutiqueId`**, a deprecated field — the real filter should use `ownerBoutiqueId`.
3. **`sales.json` records carry a `productImage` field** that isn't part of the `Sale` interface — either add it to the model (it's genuinely useful for the sales-history UI) or drop it; don't leave it undocumented.
4. **Auth reads a hardcoded URL** instead of going through the shared endpoint config — not an API concern, but means today changing `API_ENDPOINTS.USERS` alone won't repoint login; both must change together during migration.
5. **`API_ENDPOINTS.COMMISSIONS` and `.REPORTS`** are declared with no backing data and no consumer — either implement them (a commissions-rules config endpoint, a reports endpoint) or remove the dead constants.
6. **The mock JWT is double-base64-encoded** and non-standard — issue real signed JWTs.
7. **`users.json` has duplicate `-legacy` records** (14 rows for 10 logical users) — an artifact of iterative mock data changes; the real user table obviously has one row per user.
8. **`feed-products.json`'s `liked` flag is static**, not per-user — the real API must compute it per requesting user (e.g. a join against a `feed_likes` table).
9. **`admin-stats.json`'s `value` is a pre-formatted string** (`"2,847"`) rather than a raw number — see note in [§18](#18-endpoints--admin).

---

## 23. Migration checklist

1. Add `apps/oxtore-mobile/src/environments/environment.ts` (+ `.prod.ts`) with `apiBaseUrl`, and prefix every path in `api-endpoints.constants.ts` with it instead of `/assets/mock-data/...`.
2. Add an `HttpInterceptorFn` that attaches `Authorization: Bearer {token}` from `AuthService.getToken()` to every outgoing request, and a second one that catches 401s and forces logout/redirect to `/login`.
3. Replace `AuthService`'s mock JWT + `/assets/mock-data/users.json` fetch with real calls to [§4](#4-endpoints--auth); keep the same `login/signup/googleLogin/completeProfile/logout` method signatures so no caller (`AuthFacade`) needs to change.
4. Replace each `mock/api/*ApiService` and `core/services/*.ts`'s `HttpClient.get(local json)` + in-memory mutation with real HTTP calls per the endpoint sections above — the public method signatures (`getAll`, `create`, `update`, `delete`, etc.) can stay identical, only the implementation changes.
5. Implement the **checkout/order-creation gap** ([§15](#15-endpoints--cart--checkout--orders)) — this doesn't exist in any form today, mock or otherwise.
6. Move partner-product visibility filtering ([§11](#11-endpoints--boutique-network-partnerships)) server-side.
7. Fix the discrepancies in [§22](#22-mock-data-quirks-to-not-replicate) before or during migration, not after — they're cheap to fix now and expensive once a real DB schema is built around them.
8. Add the two recommended guards noted in [§21](#21-route--guard--data-map) (`PendingOtpGuard`, `PendingProfileGuard`) so `/verify-otp` and `/complete-phone` can't be hit directly.
9. Decide on the geolocation proxy ([§20](#20-external-api--geolocation-reverse-geocode)) before shipping to production.
