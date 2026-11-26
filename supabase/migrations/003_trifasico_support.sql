-- ============================================================================
-- SOPORTE NATIVO PARA MEDIDORES TRIFÁSICOS Y CÓDIGOS OBIS (1.8.1, 1.8.2, 1.6.1, 1.6.2.1)
-- Opcional pero recomendado: ejecútalo en el SQL Editor de Supabase
-- (La aplicación también soporta respaldo automático si aún no ejecutas este script)
-- ============================================================================

ALTER TABLE public.meters
  ADD COLUMN IF NOT EXISTS es_trifasico BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS codigos_obis JSONB;

ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS lecturas_obis JSONB;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
