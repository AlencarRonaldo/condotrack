-- Adiciona campo slug na tabela condos para URLs amigáveis de acesso do morador
ALTER TABLE public.condos ADD COLUMN IF NOT EXISTS slug TEXT;

-- Constraint de unicidade
ALTER TABLE public.condos ADD CONSTRAINT condos_slug_unique UNIQUE (slug);

-- Index para buscas rápidas por slug
CREATE INDEX IF NOT EXISTS idx_condos_slug ON public.condos(slug);

-- Backfill: gera slug para condos existentes a partir do nome + 4 primeiros chars do UUID
UPDATE public.condos
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(
        name,
        'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      ),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
) || '-' || LEFT(id::text, 4)
WHERE slug IS NULL;
