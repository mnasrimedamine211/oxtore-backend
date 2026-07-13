/*
# Core Schema: Profiles, Boutiques, Employees

## Purpose
Establishes the foundational tables for the Oxtore marketplace:
- User profiles extending Supabase auth.users
- Boutiques (multi-store marketplace)
- Boutique owners (many-to-many)
- Employees (HR)

## New Tables
- profiles: extends auth.users with app fields (role, permissions, phone, avatar, verified)
- boutiques: multi-store marketplace entities
- boutique_owners: junction for many-to-many User↔Boutique ownership
- employees: HR records scoped to boutiques

## Security
- RLS enabled on all tables
- Owner-scoped policies using auth.uid()
- Boutique access via ownership or management
*/

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'SELLER', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE boutique_status AS ENUM ('active', 'pending', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- PROFILES (no FK to boutiques yet - added after boutiques created)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar text,
  role user_role NOT NULL DEFAULT 'USER',
  permissions text[] NOT NULL DEFAULT '{}',
  is_verified boolean NOT NULL DEFAULT false,
  active_boutique_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE deleted_at IS NULL;

-- ============================================
-- BOUTIQUES
-- ============================================
CREATE TABLE IF NOT EXISTS boutiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo text,
  address text NOT NULL,
  phone text NOT NULL,
  description text NOT NULL DEFAULT '',
  manager_id uuid REFERENCES profiles(id),
  status boutique_status NOT NULL DEFAULT 'pending',
  language text NOT NULL DEFAULT 'en',
  currency text NOT NULL DEFAULT 'USD',
  categories text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_boutiques_manager ON boutiques(manager_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_boutiques_status ON boutiques(status) WHERE deleted_at IS NULL;

-- Now add FK from profiles.active_boutique_id to boutiques
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_active_boutique_id_fkey;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_active_boutique_id_fkey
  FOREIGN KEY (active_boutique_id) REFERENCES boutiques(id) ON DELETE SET NULL;

-- ============================================
-- BOUTIQUE_OWNERS (junction)
-- ============================================
CREATE TABLE IF NOT EXISTS boutique_owners (
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (boutique_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_boutique_owners_user ON boutique_owners(user_id);

-- ============================================
-- EMPLOYEES
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  avatar text,
  role user_role NOT NULL DEFAULT 'SELLER',
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  status employee_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_employees_boutique ON employees(boutique_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_boutique ON employees(email, boutique_id) WHERE deleted_at IS NULL;

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutique_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- boutiques
DROP POLICY IF EXISTS "boutiques_select_own" ON boutiques;
CREATE POLICY "boutiques_select_own" ON boutiques FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL AND (
      manager_id = auth.uid() OR
      EXISTS (SELECT 1 FROM boutique_owners WHERE boutique_owners.boutique_id = boutiques.id AND boutique_owners.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "boutiques_insert_own" ON boutiques;
CREATE POLICY "boutiques_insert_own" ON boutiques FOR INSERT
  TO authenticated WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "boutiques_update_own" ON boutiques;
CREATE POLICY "boutiques_update_own" ON boutiques FOR UPDATE
  TO authenticated
  USING (
    manager_id = auth.uid() OR
    EXISTS (SELECT 1 FROM boutique_owners WHERE boutique_owners.boutique_id = boutiques.id AND boutique_owners.user_id = auth.uid())
  )
  WITH CHECK (
    manager_id = auth.uid() OR
    EXISTS (SELECT 1 FROM boutique_owners WHERE boutique_owners.boutique_id = boutiques.id AND boutique_owners.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "boutiques_delete_own" ON boutiques;
CREATE POLICY "boutiques_delete_own" ON boutiques FOR DELETE
  TO authenticated
  USING (
    manager_id = auth.uid() OR
    EXISTS (SELECT 1 FROM boutique_owners WHERE boutique_owners.boutique_id = boutiques.id AND boutique_owners.user_id = auth.uid())
  );

-- boutique_owners
DROP POLICY IF EXISTS "boutique_owners_select" ON boutique_owners;
CREATE POLICY "boutique_owners_select" ON boutique_owners FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM boutiques WHERE boutiques.id = boutique_owners.boutique_id AND boutiques.manager_id = auth.uid())
  );

DROP POLICY IF EXISTS "boutique_owners_insert" ON boutique_owners;
CREATE POLICY "boutique_owners_insert" ON boutique_owners
  TO authenticated WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM boutiques WHERE boutiques.id = boutique_owners.boutique_id AND boutiques.manager_id = auth.uid())
  );

DROP POLICY IF EXISTS "boutique_owners_delete" ON boutique_owners;
CREATE POLICY "boutique_owners_delete" ON boutique_owners
  TO authenticated USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM boutiques WHERE boutiques.id = boutique_owners.boutique_id AND boutiques.manager_id = auth.uid())
  );

-- employees
DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM boutiques b
      WHERE b.id = employees.boutique_id AND (
        b.manager_id = auth.uid() OR
        EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM boutiques b
      WHERE b.id = employees.boutique_id AND (
        b.manager_id = auth.uid() OR
        EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update" ON employees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boutiques b
      WHERE b.id = employees.boutique_id AND (
        b.manager_id = auth.uid() OR
        EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boutiques b
      WHERE b.id = employees.boutique_id AND (
        b.manager_id = auth.uid() OR
        EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "employees_delete" ON employees;
CREATE POLICY "employees_delete" ON employees FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM boutiques b
      WHERE b.id = employees.boutique_id AND (
        b.manager_id = auth.uid() OR
        EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())
      )
    )
  );
