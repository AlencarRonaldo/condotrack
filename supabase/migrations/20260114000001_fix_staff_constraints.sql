-- ==================================================================================
-- FIX: Adicionar constraints em staff
-- ==================================================================================

-- Adicionar is_active se não existir
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Remover duplicatas primeiro (mantém o registro mais recente)
DELETE FROM staff
WHERE id NOT IN (
  SELECT DISTINCT ON (condo_id, username) id
  FROM staff
  ORDER BY condo_id, username, created_at DESC
);

-- Adicionar constraint única em (condo_id, username)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_condo_id_username_key'
  ) THEN
    ALTER TABLE staff ADD CONSTRAINT staff_condo_id_username_key UNIQUE (condo_id, username);
  END IF;
END $$;
