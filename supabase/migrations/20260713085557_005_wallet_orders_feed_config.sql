/*
# Wallet, Orders/Cart, Feed Likes, Config

## Purpose
Implements remaining domain tables:
- Wallet: user balance and transaction history
- Orders: customer orders with cart items
- Feed likes: per-user product likes (contract quirk: separate table)
- Config: currencies and countries for marketplace

## New Tables
- wallets: user wallet balance (one per user)
- wallet_transactions: transaction history (deposits, withdrawals, sale credits)
- orders: customer orders with cart items (JSONB) and totals
- feed_likes: per-user product likes (one row per user-product pair)
- currencies: supported currencies with exchange rates
- countries: supported countries

## Business Rules
- Wallet has one record per user with balance
- Orders contain cart items as JSONB (per contract model)
- Feed likes tracked per-user for toggle and count
- Checkout (POST /api/orders) creates order + decrements stock + creates movements (transactional)

## Security
- RLS: wallet and transactions scoped to owner
- Orders scoped to user; feed_likes scoped to user
- Config tables (currencies, countries) readable by all authenticated users
*/

DO $$ BEGIN
  CREATE TYPE wallet_transaction_type AS ENUM ('deposit', 'withdrawal', 'sale_credit', 'sale_debit', 'refund', 'adjustment', 'order_payment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- WALLETS
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- ============================================
-- WALLET_TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type wallet_transaction_type NOT NULL,
  amount numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  reference_id uuid,
  reference_type text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON wallet_transactions(reference_id) WHERE reference_id IS NOT NULL;

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  shipping numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  payment_method text,
  payment_status text NOT NULL DEFAULT 'unpaid',
  shipping_address text,
  customer_name text,
  customer_phone text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status) WHERE deleted_at IS NULL;

-- ============================================
-- FEED_LIKES (per-user product likes)
-- ============================================
CREATE TABLE IF NOT EXISTS feed_likes (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_likes_product ON feed_likes(product_id);

-- ============================================
-- CURRENCIES
-- ============================================
CREATE TABLE IF NOT EXISTS currencies (
  code text PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  exchange_rate numeric(12,6) NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- COUNTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  phone_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

-- wallets
DROP POLICY IF EXISTS "wallets_select_own" ON wallets;
CREATE POLICY "wallets_select_own" ON wallets FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "wallets_insert_own" ON wallets;
CREATE POLICY "wallets_insert_own" ON wallets FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "wallets_update_own" ON wallets;
CREATE POLICY "wallets_update_own" ON wallets FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- wallet_transactions
DROP POLICY IF EXISTS "wallet_tx_select_own" ON wallet_transactions;
CREATE POLICY "wallet_tx_select_own" ON wallet_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wallets w WHERE w.id = wallet_transactions.wallet_id AND w.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "wallet_tx_insert_own" ON wallet_transactions;
CREATE POLICY "wallet_tx_insert_own" ON wallet_transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM wallets w WHERE w.id = wallet_transactions.wallet_id AND w.user_id = auth.uid())
  );

-- orders
DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own" ON orders FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_own" ON orders;
CREATE POLICY "orders_update_own" ON orders FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_delete_own" ON orders;
CREATE POLICY "orders_delete_own" ON orders FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- feed_likes
DROP POLICY IF EXISTS "feed_likes_select" ON feed_likes;
CREATE POLICY "feed_likes_select" ON feed_likes FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR product_id IN (
    SELECT p.id FROM products p WHERE EXISTS (
      SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))
    )
  ));

DROP POLICY IF EXISTS "feed_likes_insert" ON feed_likes;
CREATE POLICY "feed_likes_insert" ON feed_likes FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "feed_likes_delete" ON feed_likes;
CREATE POLICY "feed_likes_delete" ON feed_likes FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- currencies (readable by all authenticated)
DROP POLICY IF EXISTS "currencies_select" ON currencies;
CREATE POLICY "currencies_select" ON currencies FOR SELECT
  TO authenticated USING (true);

-- countries (readable by all authenticated)
DROP POLICY IF EXISTS "countries_select" ON countries;
CREATE POLICY "countries_select" ON countries FOR SELECT
  TO authenticated USING (true);
