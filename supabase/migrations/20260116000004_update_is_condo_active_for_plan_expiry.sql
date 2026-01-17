-- ==================================================================================
-- MIGRAÇÃO: ATUALIZAR FUNÇÃO is_condo_active PARA VERIFICAR VENCIMENTO DE PLANOS
-- ==================================================================================
-- Esta migração atualiza a função is_condo_active para também verificar
-- plan_end_date quando subscription_status = 'active'
-- ==================================================================================

BEGIN;

-- Recriar função is_condo_active com verificação de plan_end_date
CREATE OR REPLACE FUNCTION public.is_condo_active(condo_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  condo_record RECORD;
BEGIN
  -- Busca dados do condomínio
  SELECT 
    subscription_status,
    trial_end_date,
    plan_end_date,
    is_active
  INTO condo_record
  FROM public.condos
  WHERE id = condo_id_param;
  
  -- Se não encontrou, bloqueia acesso
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Conta inativa manualmente (admin desativou)
  IF condo_record.is_active = FALSE THEN
    RETURN FALSE;
  END IF;
  
  -- ✅ Se tem assinatura ativa, verificar se plano está vencido
  IF condo_record.subscription_status = 'active' THEN
    -- Se plan_end_date existe e está no passado, plano vencido
    IF condo_record.plan_end_date IS NOT NULL THEN
      IF (NOW() AT TIME ZONE 'UTC') > (condo_record.plan_end_date AT TIME ZONE 'UTC') THEN
        RETURN FALSE; -- Plano vencido, bloqueia acesso
      END IF;
    END IF;
    RETURN TRUE; -- Plano ativo e dentro do prazo
  END IF;
  
  -- Se está em trial, verifica se expirou
  IF condo_record.subscription_status = 'trial' THEN
    -- Trial sem data = inválido, bloqueia
    IF condo_record.trial_end_date IS NULL THEN
      RETURN FALSE;
    END IF;
    
    -- Compara em UTC para evitar problemas de timezone
    IF (NOW() AT TIME ZONE 'UTC') > (condo_record.trial_end_date AT TIME ZONE 'UTC') THEN
      RETURN FALSE; -- Trial expirado
    END IF;
    
    RETURN TRUE; -- Trial ainda ativo
  END IF;
  
  -- Outros status (expired, canceled, past_due, inactive) = bloqueado
  -- Apenas 'active' (dentro do prazo) e 'trial' (dentro do prazo) permitem acesso
  RETURN FALSE;
END;
$$;

-- Atualizar comentário da função
COMMENT ON FUNCTION public.is_condo_active(TEXT) IS 
'Verifica se um condomínio está ativo (trial válido ou assinatura ativa com plano não vencido). Retorna FALSE se trial expirou, plano vencido, conta cancelada ou inativa.';

COMMIT;
