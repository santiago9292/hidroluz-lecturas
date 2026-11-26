-- ============================================================================
-- MIGRACIÓN 004: MOTOR DE CÁLCULO TARIFARIO, CRUDOS Y ALERTAS DEDUPLICADAS
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase
-- ============================================================================

-- 1. Configuración tarifaria y de alertas por medidor
ALTER TABLE public.meters
  ADD COLUMN IF NOT EXISTS es_trifasico BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS codigos_obis JSONB,
  ADD COLUMN IF NOT EXISTS config_tarifaria JSONB;

-- 2. Lecturas: conservar valores crudos intactos + cálculos derivados separados
ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS valor_crudo NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS lecturas_obis JSONB,
  ADD COLUMN IF NOT EXISTS calculos JSONB,
  ADD COLUMN IF NOT EXISTS evento_lectura TEXT;

-- 3. Alertas: permitir alertas de 24h sin reading_id, severidades aviso/ambar/roja
--    y metadatos estructurados para no duplicar en el mismo periodo salvo que empeore
ALTER TABLE public.alerts
  ALTER COLUMN reading_id DROP NOT NULL;

ALTER TABLE public.alerts
  DROP CONSTRAINT IF EXISTS alerts_tipo_alerta_check;

ALTER TABLE public.alerts
  DROP CONSTRAINT IF EXISTS alerts_severidad_check;

ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_severidad_check
  CHECK (severidad IN ('aviso', 'ambar', 'roja', 'media', 'alta'));

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS codigo_regla TEXT,
  ADD COLUMN IF NOT EXISTS periodo_key TEXT,
  ADD COLUMN IF NOT EXISTS valor_detectado NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS umbral_referencia NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS causa TEXT,
  ADD COLUMN IF NOT EXISTS accion_sugerida TEXT;

CREATE INDEX IF NOT EXISTS idx_alerts_dedup
  ON public.alerts(meter_id, codigo_regla, periodo_key);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
