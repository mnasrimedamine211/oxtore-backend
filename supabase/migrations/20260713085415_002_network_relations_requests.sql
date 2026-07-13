/*
# Network: Boutique Relations & Requests

## Purpose
Implements the reseller network connecting boutiques:
- Boutique requests (invite another boutique to join your network)
- Boutique relations (established connections between boutiques)

## New Tables
- boutique_requests: pending invitations between boutiques (status: pending/approved/rejected)
- boutique_relations: established connections (both boutiques can see each other's network products)

## Business Rules
- Accepting a request creates a relation atomically (handled in service layer transaction)
- Relations are bidirectional - stored once with requester_id and receiver_id
- Both boutiques in a relation can access each other's products via network-products endpoint

## Security
- RLS: boutiques can only manage requests they send or receive
- Relations visible to both participating boutiques
*/

DO $$ BEGIN
  CREATE TYPE boutique_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- BOUTIQUE_REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS boutique_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  status boutique_request_status NOT NULL DEFAULT 'pending',
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_boutique_requests_pair ON boutique_requests(requester_id, receiver_id) WHERE deleted_at IS NULL AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_boutique_requests_receiver ON boutique_requests(receiver_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_boutique_requests_requester ON boutique_requests(requester_id, status) WHERE deleted_at IS NULL;

-- ============================================
-- BOUTIQUE_RELATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS boutique_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_boutique_relations_pair ON boutique_relations(requester_id, receiver_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_boutique_relations_requester ON boutique_relations(requester_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_boutique_relations_receiver ON boutique_relations(receiver_id) WHERE deleted_at IS NULL;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE boutique_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_relations ENABLE ROW LEVEL SECURITY;

-- Helper: user can access boutique if manager or owner
-- boutique_requests
DROP POLICY IF EXISTS "boutique_requests_select" ON boutique_requests;
CREATE POLICY "boutique_requests_select" ON boutique_requests FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))) OR
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_requests.receiver_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "boutique_requests_insert" ON boutique_requests;
CREATE POLICY "boutique_requests_insert" ON boutique_requests FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "boutique_requests_update" ON boutique_requests;
CREATE POLICY "boutique_requests_update" ON boutique_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))) OR
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_requests.receiver_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))) OR
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_requests.receiver_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "boutique_requests_delete" ON boutique_requests;
CREATE POLICY "boutique_requests_delete" ON boutique_requests FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_requests.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );

-- boutique_relations
DROP POLICY IF EXISTS "boutique_relations_select" ON boutique_relations;
CREATE POLICY "boutique_relations_select" ON boutique_relations FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_relations.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))) OR
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_relations.receiver_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "boutique_relations_delete" ON boutique_relations;
CREATE POLICY "boutique_relations_delete" ON boutique_relations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_relations.requester_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid()))) OR
    EXISTS (SELECT 1 FROM boutiques b WHERE b.id = boutique_relations.receiver_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
  );
