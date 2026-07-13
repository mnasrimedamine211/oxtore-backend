# Oxtore Database Design Report

## 1. Overview

The Oxtore database is a PostgreSQL database hosted on Supabase, designed to support a mobile marketplace backend with multi-boutique network management, product catalog, inventory tracking, sales, orders, wallets, and notifications. The schema was derived directly from the API Contract canonical models.

- **Database Engine:** PostgreSQL 15 (Supabase)
- **ORM:** Prisma (typed queries; migrations applied via Supabase MCP)
- **Security:** Row Level Security (RLS) on all tables
- **Total Tables:** 22
- **Total Enums:** 23
- **Total Migrations:** 13

---

## 2. Entity Relationship Diagram (ERD)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  profiles   │────►│  boutiques   │◄───►│ boutique_requests│
│  (users)    │     │  (stores)    │     └─────────────────┘
└──────┬──────┘     └──────┬───────┘
       │                   │
       ├───► boutique_owners│
       ├───► employees ─────┤
       ├───► notifications  ├───► products ──────► wholesale_tiers
       ├───► wallets ────►   │                └──► product_commissions
       │     wallet_tx       │
       ├───► orders          ├───► stock_items
       ├───► feed_likes      ├───► inventory_movements
       ├───► user_settings   ├───► sales
       ├───► created_products│
       └──► stock_requests   ├───► boutique_relations
                            │
┌─────────────┐              │
│ categories  │◄─────────────┘
└─────────────┘

┌─────────────┐     ┌─────────────┐
│  countries  │     │  currencies │
└─────────────┘     └─────────────┘
```

### Detailed Relationship Map

```
profiles (1) ──► (N) boutiques [manager_id]
profiles (M) ──► (N) boutiques [boutique_owners join]
profiles (1) ──► (1) boutiques [active_boutique_id]
profiles (1) ──► (N) employees [via boutique]
profiles (1) ──► (N) sales [sold_by]
profiles (1) ──► (N) sales [seller_id]
profiles (1) ──► (N) stock_requests [created_by]
profiles (1) ──► (N) stock_requests [responded_by]
profiles (1) ──► (N) notifications
profiles (1) ──► (1) wallets
profiles (1) ──► (N) orders
profiles (1) ──► (N) inventory_movements [created_by]
profiles (1) ──► (N) feed_likes
profiles (1) ──► (1) user_settings
profiles (1) ──► (N) products [created_by]
profiles (1) ──► (N) boutique_relations [approved_by]
profiles (1) ──► (N) boutique_requests [responded_by]

boutiques (1) ──► (N) products [owner_boutique_id]
boutiques (1) ──► (N) stock_items
boutiques (1) ──► (N) sales
boutiques (1) ──► (N) inventory_movements
boutiques (1) ──► (N) boutique_requests [requester / receiver]
boutiques (1) ──► (N) boutique_relations [requester / receiver]
boutiques (1) ──► (N) stock_requests [requester / receiver]

products (1) ──► (N) stock_items
products (1) ──► (N) inventory_movements
products (1) ──► (N) stock_requests
products (1) ──► (N) feed_likes
products (1) ──► (N) wholesale_tiers
products (1) ──► (N) product_commissions
products (1) ──► (N) sales [product_id]

wallets (1) ──► (N) wallet_transactions
employees (1) ──► (N) sales [employee_id]
```

---

## 3. Table Descriptions

### 3.1 profiles
User accounts for all roles (ADMIN, MANAGER, SUPERVISOR, SELLER, USER). Stores authentication data (hashed password in metadata JSONB), contact info, role, permissions, and active boutique reference.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | User ID |
| full_name | text | NOT NULL | Full name |
| email | text | UNIQUE, NOT NULL | Email address |
| phone | text | | Phone number |
| avatar | text | | Avatar URL |
| role | enum | DEFAULT USER | User role |
| permissions | text[] | DEFAULT [] | Additional permissions |
| is_verified | boolean | DEFAULT false | Email/phone verification |
| metadata | jsonb | DEFAULT {} | Hashed password + extra data |
| active_boutique_id | uuid | FK → boutiques | Currently active boutique |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | | |
| deleted_at | timestamptz | | Soft delete |

### 3.2 boutiques
Store/business entities in the marketplace. Each boutique has a manager, categories, language, and currency settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| name | text | NOT NULL | Store name |
| logo | text | | Logo URL |
| address | text | NOT NULL | Physical address |
| phone | text | NOT NULL | Contact phone |
| description | text | DEFAULT '' | |
| manager_id | uuid | FK → profiles | Manager profile |
| status | enum | DEFAULT pending | active/pending/suspended |
| language | text | DEFAULT 'en' | |
| currency | text | DEFAULT 'USD' | |
| categories | text[] | DEFAULT [] | Category slugs |
| created_at, updated_at, deleted_at | | | Audit + soft delete |

### 3.3 boutique_owners
Join table (M:N) linking boutiques to their owner profiles.

| Column | Type | Constraints |
|--------|------|-------------|
| boutique_id | uuid | PK part, FK → boutiques (CASCADE) |
| user_id | uuid | PK part, FK → profiles (CASCADE) |
| created_at | timestamptz | |

### 3.4 employees
Staff members assigned to boutiques with role and status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| full_name | text | NOT NULL | |
| email | text | NOT NULL | UNIQUE with boutique_id |
| phone | text | NOT NULL | |
| avatar | text | | |
| role | enum | DEFAULT SELLER | |
| boutique_id | uuid | FK → boutiques (CASCADE) | |
| status | enum | DEFAULT pending | active/inactive/pending |
| created_at, updated_at, deleted_at | | | |

### 3.5 boutique_requests
Partnership requests between boutiques.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| requester_id | uuid | FK → boutiques (CASCADE) | |
| receiver_id | uuid | FK → boutiques (CASCADE) | |
| status | enum | DEFAULT pending | pending/approved/rejected |
| type | enum | DEFAULT RESELLER | |
| message | text | DEFAULT '' | |
| rejection_reason | text | | |
| responded_at | timestamptz | | |
| responded_by | uuid | FK → profiles (SET NULL) | |
| UNIQUE (requester_id, receiver_id) | | | |

### 3.6 boutique_relations
Active relationships between boutiques (created when a request is approved).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| requester_id | uuid | FK → boutiques (CASCADE) | |
| receiver_id | uuid | FK → boutiques (CASCADE) | |
| type | enum | DEFAULT RESELLER | |
| status | enum | DEFAULT ACTIVE | ACTIVE/SUSPENDED/TERMINATED |
| description | text | | |
| approved_at | timestamptz | | |
| approved_by | uuid | FK → profiles (SET NULL) | |
| UNIQUE (requester_id, receiver_id) | | | |

### 3.7 products
Product catalog. Contains both relational columns and embedded JSONB snapshots for inventory and pricing.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| name | text | Product name |
| description | text | |
| category | text | Category slug (not FK — contract uses string) |
| brand | text | Brand/manufacturer |
| images | text[] | Image URLs |
| owner_boutique_id | uuid FK → boutiques (CASCADE) | Owning boutique |
| created_by | uuid FK → profiles (SET NULL) | Creator |
| sku | text | UNIQUE with owner_boutique_id |
| barcode | text | |
| cost | decimal(12,2) | Cost price |
| price | decimal(12,2) | Retail price |
| wholesale_price | decimal(12,2) | Wholesale price |
| min_wholesale_qty | int | Minimum wholesale quantity |
| commission | decimal(5,2) | Default commission % |
| is_active | boolean | |
| is_public | boolean | Public visibility |
| visibility | enum | public/private |
| published | boolean | |
| published_at | timestamptz | |
| sale_types | text[] | retail, wholesale |
| wholesale_enabled | boolean | |
| consignment_enabled | boolean | |
| sale_type | enum | wholesale/retail/both |
| transaction_mode | enum | consignment/direct/commission |
| condition | enum | new/used |
| approval_status | enum | draft/pending_review/approved/rejected |
| status | text | Status string |
| inventory | jsonb | {quantity, available, safetyStock, reorderLevel, status} |
| pricing | jsonb | {purchasePrice, sellingPrice, wholesalePrice} |
| metadata | jsonb | |
| created_at, updated_at, deleted_at | | |

### 3.8 wholesale_tiers
Volume-based pricing tiers per product.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| product_id | uuid FK → products (CASCADE) | |
| min_qty | int | Minimum quantity for this tier |
| unit_price | decimal(12,2) | Price per unit at this tier |

### 3.9 product_commissions
Per-product commission rules for different actors.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| product_id | uuid FK → products (CASCADE) | |
| actor | enum | seller/supervisor/manager |
| type | enum | percentage/fixed |
| value | decimal | Commission value |

### 3.10 stock_items
Per-boutique stock for each product.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| product_id | uuid FK → products (CASCADE) | |
| boutique_id | uuid FK → boutiques (CASCADE) | |
| quantity | int | Total quantity |
| available | int | Available (quantity - reserved) |
| reserved | int | Reserved for pending orders |
| min_quantity | int | Minimum threshold |
| safety_stock | int | Safety stock level |
| reorder_level | int | Reorder trigger |
| status | enum | in_stock/low_stock/out_of_stock |
| location | text | Storage location |
| UNIQUE (product_id, boutique_id) | | |

### 3.11 inventory_movements
Audit trail of all stock changes.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| product_id | uuid FK → products (CASCADE) | |
| boutique_id | uuid FK → boutiques (CASCADE) | |
| type | enum | in/out/adj |
| reason | enum | sale/restock/adjustment/transfer_in/transfer_out/return/damage/initial |
| quantity | int | Change quantity (positive or negative) |
| reference_id | uuid | Related entity ID |
| reference_type | text | Related entity type |
| note | text | |
| created_by | uuid FK → profiles | |

### 3.12 sales
Sales records. Supports both per-product (contract-aligned) and multi-item (backward compatible) models.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| boutique_id | uuid FK → boutiques (CASCADE) | |
| employee_id | uuid FK → employees (SET NULL) | |
| sold_by | uuid FK → profiles (SET NULL) | |
| product_id | uuid FK → products (SET NULL) | |
| product_name | text | Denormalized |
| seller_id | uuid FK → profiles (SET NULL) | |
| seller_name | text | Denormalized |
| quantity | int | Units sold |
| unit_price | decimal(12,2) | |
| total_amount | decimal(12,2) | |
| commissions | jsonb | [{actor, type, value, amount}] |
| net_amount | decimal(12,2) | Total minus commissions |
| items | jsonb | Multi-item cart (legacy) |
| subtotal, discount, tax, total | decimal | Multi-item totals (legacy) |
| payment_method | text | cash/card/wallet |
| status | enum | completed/pending/cancelled/refunded/confirmed |
| customer_name, customer_phone | text | |
| note | text | |

### 3.13 stock_requests
Inter-boutique stock transfer requests.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| product_id | uuid FK → products (CASCADE) | |
| requester_id | uuid FK → boutiques (CASCADE) | Requesting boutique |
| receiver_id | uuid FK → boutiques (CASCADE) | Supplying boutique |
| quantity | int | |
| status | enum | pending/approved/rejected/fulfilled/cancelled |
| note | text | |
| from_boutique_name | text | Denormalized |
| to_boutique_name | text | Denormalized |
| product_name | text | Denormalized |
| product_image | text | |
| unit_price | decimal(12,2) | |
| total_amount | decimal(12,2) | |
| rejection_reason | text | |
| responded_at, responded_by | | |
| fulfilled_at | timestamptz | |
| created_by | uuid FK → profiles | |

### 3.14 notifications
User-facing notifications.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK → profiles (CASCADE) | |
| type | enum | sale/stock_request/boutique_request/system/order/wallet/feed/employee |
| type_v2 | enum | sale/commission/stock/hr/system/network/stock_request |
| title | text | |
| message | text | |
| body | text | Extended body |
| icon | text | Icon identifier |
| data | jsonb | |
| is_read | boolean | |
| read | boolean | Contract-aligned read flag |
| meta | jsonb | |

### 3.15 wallets
User wallet balances.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid UNIQUE FK → profiles (CASCADE) | |
| balance | decimal(12,2) | Current balance |
| total | decimal(12,2) | Total value |
| available | decimal(12,2) | Available for spending |
| margin | decimal(12,2) | Margin amount |
| blocked | decimal(12,2) | Blocked amount |
| monthly_gain | decimal(12,2) | Monthly gain |
| monthly_gain_percent | decimal(5,2) | Monthly gain % |
| currency | text | Currency code |

### 3.16 wallet_transactions
Wallet transaction log.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| wallet_id | uuid FK → wallets (CASCADE) | |
| type | enum | deposit/withdrawal/sale_credit/sale_debit/refund/adjustment/order_payment |
| type_v2 | enum | deposit/withdrawal/transfer/profit/fee |
| amount | decimal(12,2) | |
| balance_after | decimal(12,2) | |
| reference_id | uuid | |
| reference_type | text | |
| note | text | |

### 3.17 orders
Customer orders.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK → profiles (CASCADE) | |
| items | jsonb | [{productId, name, price, image, quantity, condition, saleType}] |
| subtotal, discount, tax, shipping, total | decimal(12,2) | |
| status | enum | pending/paid/shipped/delivered/cancelled/refunded |
| payment_method | text | |
| payment_status | text | |
| shipping_address | text | |
| customer_name, customer_phone | text | |
| note | text | |

### 3.18 feed_likes
Per-user product likes (for marketplace feed).

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | uuid | PK part, FK → profiles (CASCADE) |
| product_id | uuid | PK part, FK → products (CASCADE) |
| created_at | timestamptz | |

### 3.19 categories
Product category taxonomy.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| name | text | Category name |
| slug | text UNIQUE | URL-safe slug |
| icon | text | Icon identifier |
| is_active | boolean | |

### 3.20 user_settings
Per-user application settings.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid UNIQUE FK → profiles (CASCADE) | |
| notifications | boolean | |
| dark_mode | boolean | |
| language | text | |
| currency | text | |

### 3.21 currencies
Currency reference data.

| Column | Type | Description |
|--------|------|-------------|
| code | text PK | ISO currency code |
| name | text | |
| label | text | Display label |
| symbol | text | Currency symbol |
| exchange_rate | decimal(12,6) | |
| delivery_fee | decimal(12,2) | |
| is_active | boolean | |

### 3.22 countries
Country reference data.

| Column | Type | Description |
|--------|------|-------------|
| code | text PK | ISO country code |
| name | text | |
| flag | text | Emoji flag |
| dial_code | text | International dial code |
| phone_code | text | |
| pattern | text | Phone regex pattern |
| currency | text | Default currency |
| language | text | Default language |
| is_active | boolean | |

---

## 4. Foreign Key Relationships

| Child Table | Column | Parent Table | On Delete |
|-------------|--------|--------------|-----------|
| boutiques | manager_id | profiles | SET NULL |
| profiles | active_boutique_id | boutiques | SET NULL |
| boutique_owners | boutique_id | boutiques | CASCADE |
| boutique_owners | user_id | profiles | CASCADE |
| employees | boutique_id | boutiques | CASCADE |
| boutique_requests | requester_id | boutiques | CASCADE |
| boutique_requests | receiver_id | boutiques | CASCADE |
| boutique_requests | responded_by | profiles | SET NULL |
| boutique_relations | requester_id | boutiques | CASCADE |
| boutique_relations | receiver_id | boutiques | CASCADE |
| boutique_relations | approved_by | profiles | SET NULL |
| products | owner_boutique_id | boutiques | CASCADE |
| products | created_by | profiles | SET NULL |
| wholesale_tiers | product_id | products | CASCADE |
| product_commissions | product_id | products | CASCADE |
| stock_items | product_id | products | CASCADE |
| stock_items | boutique_id | boutiques | CASCADE |
| inventory_movements | product_id | products | CASCADE |
| inventory_movements | boutique_id | boutiques | CASCADE |
| inventory_movements | created_by | profiles | SET NULL |
| sales | boutique_id | boutiques | CASCADE |
| sales | employee_id | employees | SET NULL |
| sales | sold_by | profiles | SET NULL |
| sales | seller_id | profiles | SET NULL |
| sales | product_id | products | SET NULL |
| stock_requests | product_id | products | CASCADE |
| stock_requests | requester_id | boutiques | CASCADE |
| stock_requests | receiver_id | boutiques | CASCADE |
| stock_requests | created_by | profiles | SET NULL |
| stock_requests | responded_by | profiles | SET NULL |
| notifications | user_id | profiles | CASCADE |
| wallets | user_id | profiles | CASCADE |
| wallet_transactions | wallet_id | wallets | CASCADE |
| orders | user_id | profiles | CASCADE |
| feed_likes | user_id | profiles | CASCADE |
| feed_likes | product_id | products | CASCADE |
| user_settings | user_id | profiles | CASCADE |

---

## 5. Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| profiles | idx_profiles_email | email | Login lookup |
| profiles | idx_profiles_role | role | Role-based queries |
| boutiques | idx_boutiques_manager | manager_id | Manager's boutiques |
| boutiques | idx_boutiques_status | status | Active boutique filter |
| boutique_owners | idx_boutique_owners_user | user_id | User's boutiques |
| employees | idx_employees_boutique | boutique_id | Boutique staff |
| employees | idx_employees_role | role | Role filter |
| employees | idx_employees_status | status | Active employees |
| boutique_requests | idx_boutique_requests_receiver | receiver_id, status | Inbox queries |
| boutique_requests | idx_boutique_requests_requester | requester_id, status | Sent requests |
| boutique_relations | idx_boutique_relations_requester | requester_id | |
| boutique_relations | idx_boutique_relations_receiver | receiver_id | |
| boutique_relations | idx_boutique_relations_status | status | Active relations |
| products | idx_products_owner_boutique | owner_boutique_id | Boutique products |
| products | idx_products_category | category | Category filter |
| products | idx_products_active | is_active | Active products |
| products | idx_products_brand | brand | Brand filter |
| products | idx_products_is_public | is_public | Public catalog |
| products | idx_products_published | published | Published only |
| products | idx_products_approval_status | approval_status | Moderation queue |
| products | idx_products_created_by | created_by | Creator's products |
| wholesale_tiers | idx_wholesale_tiers_product | product_id, min_qty | Tier lookup |
| product_commissions | idx_product_commissions_product | product_id | Commission lookup |
| stock_items | idx_stock_items_product | product_id | Product stock |
| stock_items | idx_stock_items_boutique | boutique_id | Boutique inventory |
| inventory_movements | idx_inventory_movements_product | product_id, created_at | Product history |
| inventory_movements | idx_inventory_movements_boutique | boutique_id, created_at | Boutique history |
| inventory_movements | idx_inventory_movements_reason | reason, created_at | Reason filter |
| inventory_movements | idx_inventory_movements_reference | reference_id | Reference lookup |
| sales | idx_sales_boutique | boutique_id, created_at | Boutique sales |
| sales | idx_sales_status | status | Status filter |
| sales | idx_sales_employee | employee_id | Employee sales |
| sales | idx_sales_date | created_at | Date range |
| sales | idx_sales_product | product_id | Product sales |
| sales | idx_sales_seller | seller_id | Seller sales |
| stock_requests | idx_stock_requests_requester | requester_id, status | Sent requests |
| stock_requests | idx_stock_requests_receiver | receiver_id, status | Received requests |
| stock_requests | idx_stock_requests_product | product_id | Product requests |
| notifications | idx_notifications_user | user_id, created_at | User notifications |
| notifications | idx_notifications_unread | user_id, is_read | Unread count |
| wallets | idx_wallets_user | user_id | User wallet |
| wallet_transactions | idx_wallet_tx_wallet | wallet_id, created_at | Transaction history |
| wallet_transactions | idx_wallet_tx_reference | reference_id | Reference lookup |
| orders | idx_orders_user | user_id, created_at | User orders |
| orders | idx_orders_status | status | Status filter |
| feed_likes | idx_feed_likes_product | product_id | Like count |
| categories | idx_categories_active | is_active | Active categories |
| user_settings | idx_user_settings_user | user_id | User settings |

---

## 6. Constraints

### Unique Constraints
| Table | Constraint | Columns |
|-------|-----------|---------|
| profiles | email unique | email |
| boutique_owners | composite PK | (boutique_id, user_id) |
| employees | unique | (email, boutique_id) |
| boutique_requests | unique | (requester_id, receiver_id) |
| boutique_relations | unique | (requester_id, receiver_id) |
| products | unique | (sku, owner_boutique_id) |
| stock_items | unique | (product_id, boutique_id) |
| wallets | unique | user_id |
| user_settings | unique | user_id |
| categories | unique | slug |
| feed_likes | composite PK | (user_id, product_id) |

### Check Constraints
- All numeric columns default to 0 (prevents null in arithmetic)
- Boolean columns default to false (except is_active defaults to true)
- Text columns default to empty string where applicable

---

## 7. Row Level Security (RLS)

RLS is enabled on all 22 tables. Each table has 4 policies (SELECT, INSERT, UPDATE, DELETE) scoped to `authenticated` users with ownership checks via `auth.uid()`.

**Pattern:**
- SELECT: `USING (auth.uid() = user_id)` or ownership through boutique membership
- INSERT: `WITH CHECK (auth.uid() = user_id)`
- UPDATE: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- DELETE: `USING (auth.uid() = user_id)`

---

## 8. Seeded Data

The seed script (`prisma/seed.ts`) populates the following:

| Entity | Count | Notes |
|--------|-------|-------|
| Currencies | 5 | USD, EUR, GBP, MAD, AED |
| Countries | 8 | US, GB, FR, MA, AE, DE, ES, IT |
| Categories | 8 | Electronics, Clothing, Automobile, Home & Garden, Beauty, Sports, Toys, Food |
| Users (Profiles) | 5 | Admin, Manager, Supervisor, Seller, Buyer — all verified |
| User Settings | 5 | One per user |
| Boutiques | 3 | TechWorld Casablanca, Mode Maison Rabat, AutoParts Marrakech |
| Boutique Owners | 3 | Admin owns all boutiques |
| Boutique Relations | 1 | TechWorld ↔ Mode Maison (ACTIVE, RESELLER) |
| Boutique Requests | 1 | Mode Maison → AutoParts (pending) |
| Employees | 4 | 2 at TechWorld, 1 at Mode Maison, 1 at AutoParts |
| Products | 5 | iPhone 15, Galaxy S24, Leather Jacket, Car Mats, Wireless Charger |
| Wholesale Tiers | 4 | 2 for iPhone, 2 for Car Mats |
| Product Commissions | 5 | Various actors and types |
| Stock Items | 5 | One per product |
| Inventory Movements | 6 | Initial stock + 1 sale + 1 adjustment |
| Sales | 4 | 3 confirmed, 1 pending |
| Stock Requests | 2 | 1 approved, 1 pending |
| Wallets | 5 | One per user with varying balances |
| Wallet Transactions | 4 | Deposits, credits, payments |
| Orders | 2 | 1 delivered, 1 shipped |
| Notifications | 6 | Various types |
| Feed Likes | 4 | Buyer likes 3 products, Seller likes 1 |

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@oxtore.com | Admin123!@# |
| Manager | manager@oxtore.com | Manager123!@# |
| Supervisor | supervisor@oxtore.com | Seller123!@# |
| Seller | seller@oxtore.com | Seller123!@# |
| Buyer | buyer@oxtore.com | User123!@# |

---

## 9. Migration History

| # | File | Description |
|---|------|-------------|
| 001 | 001_core_profiles_boutiques_employees | Base tables: profiles, boutiques, owners, employees |
| 002 | 002_network_relations_requests | Boutique network: requests + relations |
| 003 | 003_products_stock_movements | Catalog: products, stock, inventory movements |
| 004 | 004_sales_stock_requests_notifications | Commerce: sales, stock requests, notifications |
| 005 | 005_wallet_orders_feed_likes_config | Finance: wallets, orders, feed likes, config tables |
| 006 | 006_add_profile_metadata | Added metadata JSONB to profiles |
| 007 | 007_align_products_with_contract | 15+ product columns, wholesale_tiers, product_commissions |
| 008 | 008_align_stock_with_contract | Stock: available, reserved, safetyStock, reorderLevel, status |
| 009 | 009_align_sales_with_contract | Sales: productId, productName, sellerId, quantity, commissions |
| 010 | 010_align_boutique_relations_requests | Relations/Requests: type, status, approvedBy, rejectionReason |
| 011 | 011_align_stock_requests | Stock requests: denormalized names, unitPrice, totalAmount |
| 012 | 012_align_notifications_wallet_config | Notifications: body, icon, read, meta. Wallet: full fields. Config |
| 013 | 013_categories_user_settings | Categories + user settings tables |

---

## 10. Recommended Future Optimizations

1. **Full-text search** — Add PostgreSQL `tsvector` columns and GIN indexes on product name and description for search.
2. **Database-level computed columns** — Calculate `available` as `quantity - reserved` via generated column instead of application logic.
3. **Partitioning** — Partition `inventory_movements` and `sales` by `created_at` for time-series query performance at scale.
4. **Materialized views** — Create materialized views for boutique dashboard aggregates (total sales, stock value, low-stock alerts).
5. **Redis caching** — Cache frequently accessed product catalog and feed data in Redis (already configured in the stack).
6. **Audit log table** — A generic `audit_logs` table for tracking all entity changes with old/new JSONB values.
7. **Soft-delete cleanup job** — Scheduled job to purge records with `deleted_at` older than a retention period.
8. **Database triggers** — Auto-update `stock_items.status` based on `available` vs `safety_stock` comparison.
9. **Connection pooling** — Configure PgBouncer for production connection management.
10. **Backup strategy** — Supabase provides automated backups; configure point-in-time recovery for production.
