-- ==================================================================================
-- FIX: Adicionar unit_id em residents e criar índice
-- ==================================================================================

-- Adicionar coluna unit_id se não existir
ALTER TABLE residents ADD COLUMN IF NOT EXISTS unit_id BIGINT;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_residents_unit ON residents(unit_id);

-- Adicionar foreign key se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema='public'
      AND table_name='residents'
      AND constraint_type='FOREIGN KEY'
      AND constraint_name='residents_unit_id_fkey'
  ) THEN
    ALTER TABLE residents
      ADD CONSTRAINT residents_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;
  END IF;
END $$;
