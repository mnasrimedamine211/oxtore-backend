/*
# Products, Stock, Inventory Movements

## Purpose
Implements the product catalog with inventory tracking:
- Products with pricing, commissions, wholesale tiers
- Stock items (inventory per product)
- Inventory movements (audit trail of stock changes)

## New Tables
- products: catalog items owned by boutiques (uses `category` string field per contract)
- stock_items: inventory records per product/boutique
- inventory_movements: audit trail of all stock changes (in/out reasons)

## Business Rules
- Product.category is a plain string field (per contract quirk, not categoryId)
- Products filtered by ownerBoutiqueId (not boutiqueId) per contract
- Stock movements track every inventory change with reason and reference

## Security
- RLS: boutique managers/owners can CRUD their products and stock
*/

DO $$ BEGIN
  CREATE TYPE stock_reason AS ENUM ('sale', 'restock', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'damage', 'initial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  owner_boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  sku text,
  barcode text,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  price numeric(12,2) NOT NULL DEFAULT 0,
  wholesale_price numeric(12,2) NOT NULL DEFAULT 0,
  min_wholesale_qty int NOT NULL DEFAULT 0,
  commission numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_products_owner_boutique ON products(owner_boutique_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_boutique ON products(sku, owner_boutique_id) WHERE deleted_at IS NULL AND sku IS NOT NULL;

-- ============================================
-- STOCK_ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 0,
  min_quantity int NOT NULL DEFAULT 0,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_stock_items_product ON stock_items(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_items_boutique ON stock_items(boutique_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_items_product_boutique ON stock_items(product_id, boutique_id) WHERE deleted_at IS NULL;

-- ============================================
-- INVENTORY_MOVEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  type stock_movement_type NOT NULL,
  reason stock_reason NOT NULL,
  quantity int NOT NULL,
  reference_id uuid,
  reference_type text,
  note text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_boutique ON inventory_movements(boutique_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reason ON inventory_movements(reason, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_id) WHERE reference_id IS NOT NULL;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- products
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = products.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = products.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = products.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = products.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = products.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

-- stock_items
DROP POLICY IF EXISTS "stock_items_select" ON stock_items;
CREATE POLICY "stock_items_select" ON stock_items FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_items.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "stock_items_insert" ON stock_items;
CREATE POLICY "stock_items_insert" ON stock_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_items.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "stock_items_update" ON stock_items;
CREATE POLICY "stock_items_update" ON stock_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_items.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_items.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "stock_items_delete" ON stock_items;
CREATE POLICY "stock_items_delete" ON stock_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_items.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

-- inventory_movements
DROP POLICY IF EXISTS "inventory_movements_select" ON inventory_movements;
CREATE POLICY "inventory_movements_select" ON inventory_movements FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = inventory_movements.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "inventory_movements_insert" ON inventory_movements;
CREATE POLICY "inventory_movements_insert" ON inventory_movements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = inventory_movements.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );
