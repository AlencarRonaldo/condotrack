-- ==================================================================================
-- FIX: Adicionar is_active em staff
-- ==================================================================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
