-- ==================================================================================
-- MIGRATION: Login por email (remover condoId do login)
-- ==================================================================================
-- Muda UNIQUE(condo_id, username) para UNIQUE(username) global
-- Permite login apenas com email + senha, sem precisar do ID do condominio
-- ==================================================================================

-- Passo 1: Converter usernames legados (sem @) para formato email
UPDATE staff
SET username = username || '@' || SUBSTRING(condo_id, 1, 8) || '.condotrack.local'
WHERE username NOT LIKE '%@%';

-- Passo 2: Resolver duplicatas - manter o mais recente, renomear os antigos
DO $$
DECLARE
  dup RECORD;
  staff_row RECORD;
  row_num INTEGER;
BEGIN
  FOR dup IN
    SELECT lower(username) AS email
    FROM staff
    GROUP BY lower(username)
    HAVING count(*) > 1
  LOOP
    row_num := 0;
    FOR staff_row IN
      SELECT id FROM staff
      WHERE lower(username) = dup.email
      ORDER BY created_at DESC
    LOOP
      row_num := row_num + 1;
      -- Pula o primeiro (mais recente) - ele fica com o email original
      IF row_num > 1 THEN
        UPDATE staff
        SET username = username || '+dup' || row_num || '@' || SUBSTRING(condo_id, 1, 8) || '.condotrack.local',
            is_active = false
        WHERE id = staff_row.id;
        RAISE NOTICE 'Desativado staff duplicado id=% (email antigo: %)', staff_row.id, dup.email;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Passo 3: Dropar constraint antiga (condo_id, username)
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_condo_id_username_key;

-- Passo 4: Criar constraint global UNIQUE(username)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_username_unique'
  ) THEN
    ALTER TABLE staff ADD CONSTRAINT staff_username_unique UNIQUE (username);
  END IF;
END $$;
