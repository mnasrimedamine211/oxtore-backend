/*
# Sales, Stock Requests, Notifications

## Purpose
Implements transactional sales and stock request workflows:
- Sales records with line items
- Stock requests between boutiques (approve/reject/fulfill)
- Notifications for system events

## New Tables
- sales: sales transactions with line items (JSONB) and totals
- stock_requests: requests between boutiques for stock transfers
- notifications: user notifications for various system events

## Business Rules (transactional - enforced in service layer)
- Sale creation: create sale + decrement stock + create inventory movement + notification (ONE transaction)
- Stock request fulfill: update status + create stock movement + notification (ONE transaction)
- Stock request approve/reject: update status + notification

## Security
- RLS: boutique managers/owners can access their sales and stock requests
- Notifications scoped to individual users
*/

DO $$ BEGIN
  CREATE TYPE sale_status AS ENUM ('completed', 'pending', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_request_status AS ENUM ('pending', 'approved', 'rejected', 'fulfilled', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('sale', 'stock_request', 'boutique_request', 'system', 'order', 'wallet', 'feed', 'employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- SALES
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  sold_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status sale_status NOT NULL DEFAULT 'completed',
  customer_name text,
  customer_phone text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sales_boutique ON sales(boutique_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_employee ON sales(employee_id) WHERE deleted_at IS NULL AND employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at DESC) WHERE deleted_at IS NULL;

-- ============================================
-- STOCK_REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  quantity int NOT NULL,
  status stock_request_status NOT NULL DEFAULT 'pending',
  note text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_stock_requests_requester ON stock_requests(requester_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_requests_receiver ON stock_requests(receiver_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_requests_product ON stock_requests(product_id) WHERE deleted_at IS NULL;

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- sales
DROP POLICY IF EXISTS "sales_select" ON sales;
CREATE POLICY "sales_select" ON sales FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = sales.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert" ON sales FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = sales.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "sales_update" ON sales;
CREATE POLICY "sales_update" ON sales FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = sales.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = sales.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "sales_delete" ON sales;
CREATE POLICY "sales_delete" ON sales FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = sales.boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

-- stock_requests
DROP POLICY IF EXISTS "stock_requests_select" ON stock_requests;
CREATE POLICY "stock_requests_select" ON stock_requests FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))) OR
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_requests.receiver_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "stock_requests_insert" ON stock_requests;
CREATE POLICY "stock_requests_insert" ON stock_requests FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "stock_requests_update" ON stock_requests;
CREATE POLICY "stock_requests_update" ON stock_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))) OR
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_requests.receiver_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))) OR
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_requests.receiver_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "stock_requests_delete" ON stock_requests;
CREATE POLICY "stock_requests_delete" ON stock_requests FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = stock_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

-- notifications
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  TO authenticated USING (user_id = auth.uid());
