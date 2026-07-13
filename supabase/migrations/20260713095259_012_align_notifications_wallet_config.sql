/*
# Align Notifications, Wallet, Currencies, Countries with API Contract

## Purpose
Aligns remaining tables with canonical models from §2.

## Changes to notifications
- body (text) — contract uses 'body' not 'message'
- icon (text, default 'bell') — contract has icon field
- read (boolean, default false) — contract uses 'read' not 'is_read'
- meta (jsonb, default '{}') — contract has meta field

## New Enum: notification_type_v2
- sale, commission, stock, hr, system, network, stock_request
(replaces old enum which had different values)

## Changes to wallets
- total (numeric) — WalletBalance.total
- available (numeric) — WalletBalance.available
- margin (numeric) — WalletBalance.margin
- blocked (numeric) — WalletBalance.blocked
- monthly_gain (numeric) — WalletBalance.monthlyGain
- monthly_gain_percent (numeric) — WalletBalance.monthlyGainPercent

## New Enum: transaction_type
- deposit, withdrawal, transfer, profit, fee
(replaces wallet_transaction_type)

## Changes to currencies
- label (text) — contract uses 'label' not 'name'
- delivery_fee (numeric) — contract has deliveryFee

## Changes to countries
- flag (text) — contract has flag
- dial_code (text) — contract uses 'dialCode' not 'phone_code'
- pattern (text) — contract has regex pattern
- currency (text) — contract has currency reference
- language (text) — contract has language: en/fr/ar
*/

-- ============================================
-- NOTIFICATIONS
-- ============================================
DO $$ BEGIN
  CREATE TYPE notification_type_v2 AS ENUM ('sale', 'commission', 'stock', 'hr', 'system', 'network', 'stock_request');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'bell',
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS type_v2 notification_type_v2;

-- Backfill body from message for existing rows
UPDATE notifications SET body = message WHERE body IS NULL;

-- ============================================
-- WALLETS
-- ============================================
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_gain numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_gain_percent numeric(5,2) NOT NULL DEFAULT 0;

-- Backfill: total = balance, available = balance for existing rows
UPDATE wallets SET total = balance, available = balance WHERE total = 0;

-- ============================================
-- WALLET TRANSACTIONS - new type enum
-- ============================================
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'profit', 'fee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS type_v2 transaction_type;

-- ============================================
-- CURRENCIES
-- ============================================
ALTER TABLE currencies
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2) NOT NULL DEFAULT 0;

-- Backfill label from name
UPDATE currencies SET label = name WHERE label IS NULL;

-- ============================================
-- COUNTRIES
-- ============================================
ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS flag text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dial_code text,
  ADD COLUMN IF NOT EXISTS pattern text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- Backfill dial_code from phone_code
UPDATE countries SET dial_code = phone_code WHERE dial_code IS NULL AND phone_code IS NOT NULL;
