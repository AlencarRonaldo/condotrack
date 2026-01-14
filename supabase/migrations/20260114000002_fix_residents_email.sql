-- ==================================================================================
-- FIX: Adicionar coluna email em residents (se não existir)
-- ==================================================================================

ALTER TABLE residents ADD COLUMN IF NOT EXISTS email TEXT;

