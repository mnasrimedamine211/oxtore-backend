-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'SELLER', 'USER');

-- CreateEnum
CREATE TYPE "BoutiqueStatus" AS ENUM ('active', 'pending', 'suspended');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('active', 'inactive', 'pending');

-- CreateEnum
CREATE TYPE "BoutiqueRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "BoutiqueRelationType" AS ENUM ('RESELLER');

-- CreateEnum
CREATE TYPE "BoutiqueRelationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('completed', 'pending', 'cancelled', 'refunded', 'confirmed');

-- CreateEnum
CREATE TYPE "StockRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'fulfilled', 'cancelled');

-- CreateEnum
CREATE TYPE "StockReason" AS ENUM ('sale', 'restock', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'damage', 'initial');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('in', 'out', 'adj');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('sale', 'stock_request', 'boutique_request', 'system', 'order', 'wallet', 'feed', 'employee');

-- CreateEnum
CREATE TYPE "NotificationTypeV2" AS ENUM ('sale', 'commission', 'stock', 'hr', 'system', 'network', 'stock_request');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('deposit', 'withdrawal', 'sale_credit', 'sale_debit', 'refund', 'adjustment', 'order_payment');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'withdrawal', 'transfer', 'profit', 'fee');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "ProductVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('wholesale', 'retail', 'both');

-- CreateEnum
CREATE TYPE "TransactionMode" AS ENUM ('consignment', 'direct', 'commission');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('new', 'used');

-- CreateEnum
CREATE TYPE "ProductApprovalStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ProductStockStatus" AS ENUM ('in_stock', 'low_stock', 'out_of_stock');

-- CreateEnum
CREATE TYPE "CommissionActor" AS ENUM ('seller', 'supervisor', 'manager');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('percentage', 'fixed');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "active_boutique_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutiques" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "manager_id" UUID,
    "status" "BoutiqueStatus" NOT NULL DEFAULT 'pending',
    "language" TEXT NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "boutiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_owners" (
    "boutique_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutique_owners_pkey" PRIMARY KEY ("boutique_id","user_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'SELLER',
    "boutique_id" UUID NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "status" "BoutiqueRequestStatus" NOT NULL DEFAULT 'pending',
    "type" "BoutiqueRelationType" NOT NULL DEFAULT 'RESELLER',
    "message" TEXT NOT NULL DEFAULT '',
    "rejection_reason" TEXT,
    "responded_at" TIMESTAMP(3),
    "responded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "boutique_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique_relations" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "type" "BoutiqueRelationType" NOT NULL DEFAULT 'RESELLER',
    "status" "BoutiqueRelationStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "boutique_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "owner_boutique_id" UUID NOT NULL,
    "created_by" UUID,
    "sku" TEXT,
    "barcode" TEXT,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "wholesale_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "min_wholesale_qty" INTEGER NOT NULL DEFAULT 0,
    "commission" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "visibility" "ProductVisibility" NOT NULL DEFAULT 'public',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "sale_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wholesale_enabled" BOOLEAN NOT NULL DEFAULT false,
    "consignment_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sale_type" "SaleType" NOT NULL DEFAULT 'retail',
    "transaction_mode" "TransactionMode" NOT NULL DEFAULT 'direct',
    "condition" "ProductCondition" NOT NULL DEFAULT 'new',
    "approval_status" "ProductApprovalStatus" NOT NULL DEFAULT 'draft',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "inventory" JSONB NOT NULL DEFAULT '{"quantity": 0, "available": 0, "safetyStock": 0, "reorderLevel": 0, "status": "out_of_stock"}',
    "pricing" JSONB NOT NULL DEFAULT '{"purchasePrice": 0, "sellingPrice": 0, "wholesalePrice": 0}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wholesale_tiers" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "min_qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_commissions" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "actor" "CommissionActor" NOT NULL,
    "type" "CommissionType" NOT NULL,
    "value" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "boutique_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "min_quantity" INTEGER NOT NULL DEFAULT 0,
    "safety_stock" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStockStatus" NOT NULL DEFAULT 'out_of_stock',
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "boutique_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "reason" "StockReason" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_id" UUID,
    "reference_type" TEXT,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "boutique_id" UUID NOT NULL,
    "employee_id" UUID,
    "sold_by" UUID,
    "product_id" UUID,
    "product_name" TEXT,
    "seller_id" UUID,
    "seller_name" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissions" JSONB NOT NULL DEFAULT '[]',
    "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL DEFAULT '[]',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "status" "SaleStatus" NOT NULL DEFAULT 'completed',
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_requests" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockRequestStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "from_boutique_name" TEXT,
    "to_boutique_name" TEXT,
    "product_name" TEXT,
    "product_image" TEXT,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rejection_reason" TEXT,
    "responded_at" TIMESTAMP(3),
    "responded_by" UUID,
    "fulfilled_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "type_v2" "NotificationTypeV2",
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "body" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'bell',
    "data" JSONB NOT NULL DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "available" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "margin" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "blocked" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_gain" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthly_gain_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "type_v2" "TransactionType",
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "reference_id" UUID,
    "reference_type" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "payment_method" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "shipping_address" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_likes" (
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_likes_pkey" PRIMARY KEY ("user_id","product_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "symbol" TEXT NOT NULL,
    "exchange_rate" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flag" TEXT NOT NULL DEFAULT '',
    "dial_code" TEXT,
    "phone_code" TEXT,
    "pattern" TEXT,
    "currency" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "idx_profiles_email" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "idx_profiles_role" ON "profiles"("role");

-- CreateIndex
CREATE INDEX "idx_boutiques_manager" ON "boutiques"("manager_id");

-- CreateIndex
CREATE INDEX "idx_boutiques_status" ON "boutiques"("status");

-- CreateIndex
CREATE INDEX "idx_boutique_owners_user" ON "boutique_owners"("user_id");

-- CreateIndex
CREATE INDEX "idx_employees_boutique" ON "employees"("boutique_id");

-- CreateIndex
CREATE INDEX "idx_employees_role" ON "employees"("role");

-- CreateIndex
CREATE INDEX "idx_employees_status" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_employees_email_boutique" ON "employees"("email", "boutique_id");

-- CreateIndex
CREATE INDEX "idx_boutique_requests_receiver" ON "boutique_requests"("receiver_id", "status");

-- CreateIndex
CREATE INDEX "idx_boutique_requests_requester" ON "boutique_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "idx_boutique_requests_type" ON "boutique_requests"("type");

-- CreateIndex
CREATE UNIQUE INDEX "idx_boutique_requests_pair" ON "boutique_requests"("requester_id", "receiver_id");

-- CreateIndex
CREATE INDEX "idx_boutique_relations_requester" ON "boutique_relations"("requester_id");

-- CreateIndex
CREATE INDEX "idx_boutique_relations_receiver" ON "boutique_relations"("receiver_id");

-- CreateIndex
CREATE INDEX "idx_boutique_relations_status" ON "boutique_relations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_boutique_relations_pair" ON "boutique_relations"("requester_id", "receiver_id");

-- CreateIndex
CREATE INDEX "idx_products_owner_boutique" ON "products"("owner_boutique_id");

-- CreateIndex
CREATE INDEX "idx_products_category" ON "products"("category");

-- CreateIndex
CREATE INDEX "idx_products_active" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "idx_products_brand" ON "products"("brand");

-- CreateIndex
CREATE INDEX "idx_products_is_public" ON "products"("is_public");

-- CreateIndex
CREATE INDEX "idx_products_published" ON "products"("published");

-- CreateIndex
CREATE INDEX "idx_products_approval_status" ON "products"("approval_status");

-- CreateIndex
CREATE INDEX "idx_products_created_by" ON "products"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "idx_products_sku_boutique" ON "products"("sku", "owner_boutique_id");

-- CreateIndex
CREATE INDEX "idx_wholesale_tiers_product" ON "wholesale_tiers"("product_id", "min_qty");

-- CreateIndex
CREATE INDEX "idx_product_commissions_product" ON "product_commissions"("product_id");

-- CreateIndex
CREATE INDEX "idx_stock_items_product" ON "stock_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_stock_items_boutique" ON "stock_items"("boutique_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_stock_items_product_boutique" ON "stock_items"("product_id", "boutique_id");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_product" ON "inventory_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_boutique" ON "inventory_movements"("boutique_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_reason" ON "inventory_movements"("reason", "created_at");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_reference" ON "inventory_movements"("reference_id");

-- CreateIndex
CREATE INDEX "idx_sales_boutique" ON "sales"("boutique_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_sales_status" ON "sales"("status");

-- CreateIndex
CREATE INDEX "idx_sales_employee" ON "sales"("employee_id");

-- CreateIndex
CREATE INDEX "idx_sales_date" ON "sales"("created_at");

-- CreateIndex
CREATE INDEX "idx_sales_product" ON "sales"("product_id");

-- CreateIndex
CREATE INDEX "idx_sales_seller" ON "sales"("seller_id");

-- CreateIndex
CREATE INDEX "idx_stock_requests_requester" ON "stock_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "idx_stock_requests_receiver" ON "stock_requests"("receiver_id", "status");

-- CreateIndex
CREATE INDEX "idx_stock_requests_product" ON "stock_requests"("product_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_unread" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "idx_wallets_user" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "idx_wallet_tx_wallet" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_wallet_tx_reference" ON "wallet_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "idx_orders_user" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");

-- CreateIndex
CREATE INDEX "idx_feed_likes_product" ON "feed_likes"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "idx_categories_active" ON "categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_settings_user" ON "user_settings"("user_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_active_boutique_id_fkey" FOREIGN KEY ("active_boutique_id") REFERENCES "boutiques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutiques" ADD CONSTRAINT "boutiques_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_owners" ADD CONSTRAINT "boutique_owners_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_owners" ADD CONSTRAINT "boutique_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_requests" ADD CONSTRAINT "boutique_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_requests" ADD CONSTRAINT "boutique_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_requests" ADD CONSTRAINT "boutique_requests_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_relations" ADD CONSTRAINT "boutique_relations_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_relations" ADD CONSTRAINT "boutique_relations_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boutique_relations" ADD CONSTRAINT "boutique_relations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_owner_boutique_id_fkey" FOREIGN KEY ("owner_boutique_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_tiers" ADD CONSTRAINT "wholesale_tiers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_commissions" ADD CONSTRAINT "product_commissions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_sold_by_fkey" FOREIGN KEY ("sold_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_likes" ADD CONSTRAINT "feed_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_likes" ADD CONSTRAINT "feed_likes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
