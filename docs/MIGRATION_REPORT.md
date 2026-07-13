# Oxtore Database Migration Report

## Overview

This document chronicles every database migration applied to the Oxtore backend, from initial schema creation through full API Contract alignment. All migrations were applied via Supabase MCP tools to a PostgreSQL database with Row Level Security (RLS) enabled on all tables.

**Total Migrations:** 13
**Database:** PostgreSQL (Supabase)
**ORM:** Prisma (typed queries only; migrations applied via Supabase MCP)
**RLS:** Enabled on every table

---

## Migration 001 — Core Profiles, Boutiques, Employees

**File:** `20260713085350_001_core_profiles_boutiques_employees.sql`

### Purpose
Established the foundational tables for user profiles, boutiques (stores), boutique ownership, and employees.

### New Tables
| Table | Description |
|-------|-------------|
| `profiles` | User accounts with role, email, phone, verification status, metadata |
| `boutiques` | Store entities with name, logo, address, phone, status, manager |
| `boutique_owners` | Join table linking boutiques to their owner profiles (M:N) |
| `employees` | Staff members assigned to boutiques with role and status |

### Columns Added
- **profiles**: id, full_name, email, phone, avatar, role, permissions, is_verified, metadata, active_boutique_id, created_at, updated_at, deleted_at
- **boutiques**: id, name, logo, address, phone, description, manager_id, status, language, currency, categories, created_at, updated_at, deleted_at
- **boutique_owners**: boutique_id, user_id, created_at
- **employees**: id, full_name, email, phone, avatar, role, boutique_id, status, created_at, updated_at, deleted_at

### Constraints
- `profiles.email` — UNIQUE
- `boutique_owners` — composite PK (boutique_id, user_id)
- `employees` — UNIQUE (email, boutique_id)

### Indexes
- idx_profiles_email, idx_profiles_role
- idx_boutiques_manager, idx_boutiques_status
- idx_boutique_owners_user
- idx_employees_boutique, idx_employees_role, idx_employees_status

### RLS Policies
All 4 CRUD policies per table (SELECT/INSERT/UPDATE/DELETE), scoped to `authenticated` with ownership checks via `auth.uid()`.

### Issues Encountered & Fixes
- **Circular dependency:** RLS policies on `boutiques` referenced `boutique_owners` before it was created. Fixed by reordering: create all tables first, then add RLS policies.

---

## Migration 002 — Network Relations and Requests

**File:** `20260713085415_002_network_relations_requests.sql`

### Purpose
Created the boutique network system — boutiques can send partnership requests to each other, and approved requests become relations.

### New Tables
| Table | Description |
|-------|-------------|
| `boutique_requests` | Partnership requests between boutiques with status, message |
| `boutique_relations` | Active relationships between boutiques with type and status |

### Columns Added
- **boutique_requests**: id, requester_id, receiver_id, status, message, created_at, updated_at, deleted_at
- **boutique_relations**: id, requester_id, receiver_id, type, status, description, created_at, updated_at, deleted_at

### Constraints
- `boutique_requests` — UNIQUE (requester_id, receiver_id)
- `boutique_relations` — UNIQUE (requester_id, receiver_id)

### Indexes
- idx_boutique_requests_receiver, idx_boutique_requests_requester, idx_boutique_requests_type
- idx_boutique_relations_requester, idx_boutique_relations_receiver, idx_boutique_relations_status

---

## Migration 003 — Products, Stock, Inventory Movements

**File:** `20260713085456_003_products_stock_movements.sql`

### Purpose
Created the product catalog, stock items per boutique, and inventory movement audit trail.

### New Tables
| Table | Description |
|-------|-------------|
| `products` | Product catalog with SKU, price, cost, commission, images |
| `stock_items` | Per-boutique stock quantities with min/reorder levels |
| `inventory_movements` | Audit log of all stock changes (in/out/adjustment) |

### Issues Encountered & Fixes
- `CREATE POLICY IF EXISTS` is not valid PostgreSQL syntax. Changed to `DROP POLICY IF EXISTS` followed by `CREATE POLICY`.

---

## Migration 004 — Sales, Stock Requests, Notifications

**File:** `20260713085536_004_sales_stock_requests_notifications.sql`

### Purpose
Created the sales recording system, inter-boutique stock requests, and user notifications.

### New Tables
| Table | Description |
|-------|-------------|
| `sales` | Sales records with items JSONB, totals, payment method, status |
| `stock_requests` | Requests from one boutique to another for product stock |
| `notifications` | User-facing notifications with type, title, message, read status |

---

## Migration 005 — Wallet, Orders, Feed Likes, Config

**File:** `20260713085557_005_wallet_orders_feed_likes_config.sql`

### Purpose
Created the wallet system, customer orders, feed likes (per-user product likes), and configuration tables.

### New Tables
| Table | Description |
|-------|-------------|
| `wallets` | User wallet with balance, available, blocked amounts |
| `wallet_transactions` | Transaction log with type, amount, balance after |
| `orders` | Customer orders with items JSONB, totals, shipping, payment status |
| `feed_likes` | Per-user product likes (composite PK user_id + product_id) |
| `currencies` | Currency reference data with exchange rates and delivery fees |
| `countries` | Country reference data with dial codes and phone patterns |

---

## Migration 006 — Profile Metadata

**File:** `20260713085905_006_add_profile_metadata.sql`

### Purpose
Added a `metadata` JSONB column to `profiles` for storing hashed passwords and other user-specific data.

### Columns Modified
- **profiles**: added `metadata` JSONB NOT NULL DEFAULT '{}'

---

## Migration 007 — Align Products with API Contract

**File:** `20260713090030_007_align_products_with_contract.sql`

### Purpose
Major alignment of the `products` table with the API Contract canonical Product model. Added 15+ new columns and two new child tables.

### Columns Added to `products`
| Column | Type | Description |
|--------|------|-------------|
| `brand` | text | Product brand/manufacturer |
| `created_by` | uuid | User who created the product (FK to profiles) |
| `is_public` | boolean | Whether product is publicly visible |
| `visibility` | enum | public / private |
| `published` | boolean | Whether product is published |
| `published_at` | timestamptz | When product was published |
| `sale_types` | text[] | Array of sale types (retail, wholesale) |
| `wholesale_enabled` | boolean | Whether wholesale is enabled |
| `consignment_enabled` | boolean | Whether consignment is enabled |
| `sale_type` | enum | wholesale / retail / both |
| `transaction_mode` | enum | consignment / direct / commission |
| `condition` | enum | new / used |
| `approval_status` | enum | draft / pending_review / approved / rejected |
| `status` | text | Product status (draft, published, etc.) |
| `inventory` | jsonb | Embedded inventory snapshot (quantity, available, safetyStock, reorderLevel, status) |
| `pricing` | jsonb | Embedded pricing snapshot (purchasePrice, sellingPrice, wholesalePrice) |

### New Tables
| Table | Description |
|-------|-------------|
| `wholesale_tiers` | Volume-based pricing tiers per product (min_qty, unit_price) |
| `product_commissions` | Per-product commission rules (actor, type, value) |

### New Enums
- ProductVisibility (public, private)
- SaleType (wholesale, retail, both)
- TransactionMode (consignment, direct, commission)
- ProductCondition (new, used)
- ProductApprovalStatus (draft, pending_review, approved, rejected)
- CommissionActor (seller, supervisor, manager)
- CommissionType (percentage, fixed)

---

## Migration 008 — Align Stock with API Contract

**File:** `20260713090115_008_align_stock_with_contract.sql`

### Purpose
Aligned `stock_items` with the API Contract canonical StockItem model.

### Columns Added to `stock_items`
| Column | Type | Description |
|--------|------|-------------|
| `available` | int | Available quantity (quantity - reserved) |
| `reserved` | int | Reserved for pending orders/requests |
| `safety_stock` | int | Minimum safety stock threshold |
| `reorder_level` | int | Reorder trigger level |
| `status` | enum | in_stock / low_stock / out_of_stock |

### Enums Added
- ProductStockStatus (in_stock, low_stock, out_of_stock)
- StockMovementType: added `adj` (adjustment) value

---

## Migration 009 — Align Sales with API Contract

**File:** `20260713090200_009_align_sales_with_contract.sql`

### Purpose
Aligned `sales` with the API Contract canonical Sale model, which is per-product (not multi-item cart).

### Columns Added to `sales`
| Column | Type | Description |
|--------|------|-------------|
| `product_id` | uuid | FK to products table |
| `product_name` | text | Denormalized product name at time of sale |
| `seller_id` | uuid | FK to profiles (seller) |
| `seller_name` | text | Denormalized seller name |
| `quantity` | int | Units sold |
| `unit_price` | decimal(12,2) | Price per unit |
| `total_amount` | decimal(12,2) | quantity × unit_price |
| `commissions` | jsonb | Array of commission objects |
| `net_amount` | decimal(12,2) | Total minus commissions |

### Design Decision
The API Contract uses a per-product Sale model. The original multi-item JSONB columns (`items`, `subtotal`, `discount`, `tax`, `total`) were kept for backward compatibility. Both sets of columns coexist.

---

## Migration 010 — Align Boutique Relations/Requests with API Contract

**File:** `20260713090245_010_align_boutique_relations_requests.sql`

### Purpose
Aligned `boutique_relations` and `boutique_requests` with the API Contract.

### Columns Added to `boutique_requests`
| Column | Type | Description |
|--------|------|-------------|
| `type` | enum | RESELLER (extensible) |
| `rejection_reason` | text | Reason for rejection |
| `responded_at` | timestamptz | When the request was responded to |
| `responded_by` | uuid | FK to profiles (who responded) |

### Columns Added to `boutique_relations`
| Column | Type | Description |
|--------|------|-------------|
| `type` | enum | RESELLER (extensible) |
| `status` | enum | ACTIVE / SUSPENDED / TERMINATED |
| `approved_at` | timestamptz | When the relation was approved |
| `approved_by` | uuid | FK to profiles (who approved) |

---

## Migration 011 — Align Stock Requests with API Contract

**File:** `20260713090330_011_align_stock_requests.sql`

### Purpose
Aligned `stock_requests` with the API Contract canonical StockRequest model.

### Columns Added to `stock_requests`
| Column | Type | Description |
|--------|------|-------------|
| `from_boutique_name` | text | Denormalized requester boutique name |
| `to_boutique_name` | text | Denormalized receiver boutique name |
| `product_name` | text | Denormalized product name |
| `product_image` | text | Product image URL |
| `unit_price` | decimal(12,2) | Price per unit |
| `total_amount` | decimal(12,2) | quantity × unit_price |
| `rejection_reason` | text | Reason for rejection |
| `responded_at` | timestamptz | When the request was responded to |
| `responded_by` | uuid | FK to profiles |
| `fulfilled_at` | timestamptz | When the request was fulfilled |

---

## Migration 012 — Align Notifications/Wallet/Currencies/Countries with API Contract

**File:** `20260713090415_012_align_notifications_wallet_config.sql`

### Purpose
Final alignment of notifications, wallets, currencies, and countries with the API Contract.

### Columns Added to `notifications`
| Column | Type | Description |
|--------|------|-------------|
| `body` | text | Extended notification body |
| `icon` | text | Icon identifier |
| `read` | boolean | Alternate read flag (contract uses `read`) |
| `meta` | jsonb | Additional metadata |

### Columns Added to `wallets`
| Column | Type | Description |
|--------|------|-------------|
| `total` | decimal(12,2) | Total wallet value |
| `available` | decimal(12,2) | Available balance |
| `margin` | decimal(12,2) | Margin amount |
| `blocked` | decimal(12,2) | Blocked amount |
| `monthly_gain` | decimal(12,2) | Monthly gain amount |
| `monthly_gain_percent` | decimal(5,2) | Monthly gain percentage |

### Columns Added to `wallet_transactions`
| Column | Type | Description |
|--------|------|-------------|
| `type_v2` | enum | TransactionType (deposit, withdrawal, transfer, profit, fee) |

### Columns Added to `currencies`
| Column | Type | Description |
|--------|------|-------------|
| `label` | text | Display label |
| `delivery_fee` | decimal(12,2) | Delivery fee for this currency |

### Columns Added to `countries`
| Column | Type | Description |
|--------|------|-------------|
| `flag` | text | Emoji flag |
| `dial_code` | text | International dial code |
| `pattern` | text | Phone number regex pattern |
| `currency` | text | Default currency code |
| `language` | text | Default language code |

### Enums Added
- TransactionType (deposit, withdrawal, transfer, profit, fee)
- NotificationTypeV2 (sale, commission, stock, hr, system, network, stock_request)

---

## Migration 013 — Categories and User Settings

**File:** `20260713090500_013_categories_user_settings.sql`

### Purpose
Created the product category taxonomy and per-user settings tables.

### New Tables
| Table | Description |
|-------|-------------|
| `categories` | Product categories with name, slug, icon, active flag |
| `user_settings` | Per-user settings (notifications, dark mode, language, currency) |

### Columns
- **categories**: id, name, slug (unique), icon, is_active, created_at, updated_at
- **user_settings**: id, user_id (unique FK to profiles), notifications, dark_mode, language, currency, created_at, updated_at

---

## Summary of Changes

### Tables Created (20 total)
1. profiles
2. boutiques
3. boutique_owners
4. employees
5. boutique_requests
6. boutique_relations
7. products
8. wholesale_tiers
9. product_commissions
10. stock_items
11. inventory_movements
12. sales
13. stock_requests
14. notifications
15. wallets
16. wallet_transactions
17. orders
18. feed_likes
19. currencies
20. countries
21. categories
22. user_settings

### Enums Created (20+)
UserRole, BoutiqueStatus, EmployeeStatus, BoutiqueRequestStatus, BoutiqueRelationType, BoutiqueRelationStatus, SaleStatus, StockRequestStatus, StockReason, StockMovementType, NotificationType, NotificationTypeV2, WalletTransactionType, TransactionType, OrderStatus, ProductVisibility, SaleType, TransactionMode, ProductCondition, ProductApprovalStatus, ProductStockStatus, CommissionActor, CommissionType

### Key Design Decisions
1. **Soft delete** (`deleted_at`) on all major entities (profiles, boutiques, employees, products, stock_items, sales, stock_requests, orders, boutique_requests, boutique_relations)
2. **Denormalized fields** in stock_requests and sales for API response efficiency (boutique names, product names, seller names)
3. **Dual Sale model** — both per-product columns (contract-aligned) and multi-item JSONB columns (backward compatible) coexist
4. **JSONB inventory/pricing snapshots** embedded in products for fast API reads
5. **RLS on every table** with 4 CRUD policies each, scoped to `authenticated` with `auth.uid()` ownership checks
6. **Cascade deletes** on child tables (stock_items, inventory_movements, orders, etc.) to maintain referential integrity
7. **SetNull on optional FKs** (manager_id, sold_by, seller_id, etc.) to preserve audit history when referenced entities are deleted
