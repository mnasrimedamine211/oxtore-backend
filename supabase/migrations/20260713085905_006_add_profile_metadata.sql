/*
# Add metadata column to profiles

## Purpose
Adds a `metadata` JSONB column to the profiles table for storing auxiliary data
like hashed passwords (for standalone auth mode) and Google OAuth sub IDs.

## Changes
- profiles: new `metadata` JSONB column, default '{}'
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
