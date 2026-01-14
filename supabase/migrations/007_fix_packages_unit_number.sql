-- ==================================================================================
-- FIX: Adicionar unit_number em packages e criar índice
-- ==================================================================================

-- Adicionar coluna unit_number se não existir
ALTER TABLE packages ADD COLUMN IF NOT EXISTS unit_number TEXT;

-- Criar índice composto
CREATE INDEX IF NOT EXISTS idx_packages_unit_number ON packages(condo_id, unit_number);

-- Popular unit_number com dados existentes (se houver packages sem unit_number)
UPDATE packages
SET unit_number = unit
WHERE unit_number IS NULL AND unit IS NOT NULL;
