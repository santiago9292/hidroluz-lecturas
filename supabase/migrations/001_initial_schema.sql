-- ============================================================================
-- HIDROLUZ CONTROL — ESQUEMA COMPLETO PARA SUPABASE (VITE + JAVASCRIPT)
-- Copia y ejecuta este script en el SQL Editor de tu proyecto en Supabase
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA DE SEDES
CREATE TABLE IF NOT EXISTS public.sedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  direccion TEXT,
  ciudad TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABLA DE USUARIOS CON ACCESO RÁPIDO POR DNI
CREATE TABLE IF NOT EXISTS public.users_app (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni VARCHAR(15) NOT NULL UNIQUE,
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'operario' CHECK (rol IN ('sysadmin', 'operario')),
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_app_dni ON public.users_app(dni);
CREATE INDEX IF NOT EXISTS idx_users_app_sede ON public.users_app(sede_id);

-- 3. TABLA DE MEDIDORES POR SEDE (Luz en kWh y Agua en m3)
CREATE TABLE IF NOT EXISTS public.meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('luz', 'agua')),
  nombre TEXT NOT NULL,
  numero_serie TEXT,
  unidad TEXT NOT NULL CHECK (unidad IN ('kWh', 'm3')),
  umbral_diario_max NUMERIC(12, 2),
  porcentaje_alerta_promedio NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meters_sede ON public.meters(sede_id);

-- 4. TABLA DE LECTURAS DE MEDIDORES
CREATE TABLE IF NOT EXISTS public.readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users_app(id) ON DELETE SET NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_dni TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('luz', 'agua')),
  valor_lectura NUMERIC(14, 2) NOT NULL,
  lectura_anterior NUMERIC(14, 2),
  dias_transcurridos NUMERIC(8, 2) NOT NULL DEFAULT 1,
  consumo_total_periodo NUMERIC(14, 2) NOT NULL DEFAULT 0,
  consumo_diario NUMERIC(14, 2) NOT NULL DEFAULT 0,
  promedio_previo NUMERIC(14, 2),
  es_anomalo BOOLEAN NOT NULL DEFAULT false,
  motivo_anomalia TEXT,
  media_url TEXT,
  media_path TEXT,
  media_tipo TEXT CHECK (media_tipo IN ('foto', 'video') OR media_tipo IS NULL),
  observaciones TEXT,
  fecha_lectura TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readings_sede_fecha ON public.readings(sede_id, fecha_lectura DESC);
CREATE INDEX IF NOT EXISTS idx_readings_meter_fecha ON public.readings(meter_id, fecha_lectura DESC);

-- 5. TABLA DE ALERTAS DE CONSUMO EXCESIVO Y ANOMALÍAS
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
  reading_id UUID NOT NULL REFERENCES public.readings(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('exceso_umbral', 'exceso_promedio', 'lectura_menor', 'salto_extremo')),
  severidad TEXT NOT NULL DEFAULT 'alta' CHECK (severidad IN ('alta', 'media')),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  resuelta BOOLEAN NOT NULL DEFAULT false,
  resuelta_por UUID REFERENCES public.users_app(id) ON DELETE SET NULL,
  resuelta_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_sede_created ON public.alerts(sede_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_resuelta ON public.alerts(resuelta);

-- 6. TABLA DE SUSCRIPCIONES WEB PUSH (Android, iOS 16.4+ PWA y PC Escritorio)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_app(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  rol TEXT NOT NULL DEFAULT 'operario',
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  plataforma TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- VALIDACIÓN ESTRICTA DE SEDE POR USUARIO EN BASE DE DATOS (TRIGGER)
-- Garantiza que cada operario solo pueda registrar lecturas de su propia sede
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_reading_user_sede()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere un usuario válido para registrar una lectura.';
  END IF;

  SELECT id, rol, sede_id, activo INTO v_user
  FROM public.users_app
  WHERE id = NEW.user_id;

  IF NOT FOUND OR v_user.activo = false THEN
    RAISE EXCEPTION 'El usuario no existe o se encuentra inactivo.';
  END IF;

  IF v_user.rol <> 'sysadmin' AND (v_user.sede_id IS NULL OR v_user.sede_id <> NEW.sede_id) THEN
    RAISE EXCEPTION 'No tienes permiso para registrar lecturas fuera de tu sede asignada.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_reading_user_sede ON public.readings;
CREATE TRIGGER trg_validate_reading_user_sede
  BEFORE INSERT ON public.readings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reading_user_sede();

-- ============================================================================
-- PERMISOS DE ESQUEMA Y ROW LEVEL SECURITY (ACCESO CON PUBLISHABLE / ANON KEY)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_app ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sedes', 'users_app', 'meters', 'readings', 'alerts', 'push_subscriptions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Acceso app %I" ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY "Acceso app %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================================
-- STORAGE BUCKET `evidencias` PARA FOTOS Y VIDEOS DE MEDIDORES (HASTA 50 MB)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias',
  'evidencias',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Evidencias lectura publica" ON storage.objects;
CREATE POLICY "Evidencias lectura publica" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "Evidencias subida app" ON storage.objects;
CREATE POLICY "Evidencias subida app" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "Evidencias borrado app" ON storage.objects;
CREATE POLICY "Evidencias borrado app" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'evidencias');

-- ============================================================================
-- PUBLICACIÓN SUPABASE REALTIME (ACTUALIZACIONES EN TIEMPO REAL)
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['sedes', 'users_app', 'meters', 'readings', 'alerts']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- DATOS SEMILLA INICIALES (SYSADMIN POR DEFECTO + SEDE CENTRAL)
-- Puedes ingresar de inmediato con el DNI: 00000000
-- ============================================================================
INSERT INTO public.sedes (id, nombre, codigo, direccion, ciudad, activa)
VALUES ('11111111-1111-1111-1111-111111111111', 'Sede Central', 'SEDE-01', 'Av. Principal 100', 'Lima', true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.users_app (dni, nombre_completo, rol, sede_id, activo)
VALUES ('00000000', 'Administrador General (Sysadmin)', 'sysadmin', NULL, true)
ON CONFLICT (dni) DO NOTHING;

INSERT INTO public.meters (sede_id, tipo, nombre, numero_serie, unidad, umbral_diario_max, porcentaje_alerta_promedio)
SELECT '11111111-1111-1111-1111-111111111111', 'luz', 'Medidor Principal Luz', 'LUZ-001', 'kWh', 180, 30
WHERE NOT EXISTS (
  SELECT 1 FROM public.meters WHERE sede_id = '11111111-1111-1111-1111-111111111111' AND tipo = 'luz'
);

INSERT INTO public.meters (sede_id, tipo, nombre, numero_serie, unidad, umbral_diario_max, porcentaje_alerta_promedio)
SELECT '11111111-1111-1111-1111-111111111111', 'agua', 'Medidor Principal Agua', 'AGUA-001', 'm3', 25, 30
WHERE NOT EXISTS (
  SELECT 1 FROM public.meters WHERE sede_id = '11111111-1111-1111-1111-111111111111' AND tipo = 'agua'
);
