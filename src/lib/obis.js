/**
 * Plantilla estándar de códigos OBIS para medidores eléctricos trifásicos
 * (1.8.1 y 1.8.2 = Energía activa acumulada en kWh; 1.6.1 y 1.6.2.1 = Demanda / Punto)
 */
export const DEFAULT_TRIFASICO_CODES = [
  {
    code: '1.8.1',
    label: 'Energía F. Punta',
    unit: 'kWh',
    sumaConsumo: true,
  },
  {
    code: '1.8.2',
    label: 'Energía H. Punta',
    unit: 'kWh',
    sumaConsumo: true,
  },
  {
    code: '1.6.1',
    label: 'Punto / Dem. 1',
    unit: 'kW',
    sumaConsumo: false,
  },
  {
    code: '1.6.2.1',
    label: 'Demanda 2',
    unit: 'kW',
    sumaConsumo: false,
  },
];

const METER_META_PREFIX = '__OBISCFG__:';
const READING_META_PREFIX = '__OBISVAL__:';

/**
 * Obtiene la configuración trifásica efectiva de un medidor (desde columnas JSONB
 * o desde metadatos embebidos en numero_serie si aún no se migró la columna SQL).
 */
export function normalizeMeterObis(meter) {
  if (!meter) return meter;

  let esTrifasico = Boolean(meter.es_trifasico);
  let codigosObis = Array.isArray(meter.codigos_obis) ? meter.codigos_obis : null;
  let cleanSerie = meter.numero_serie || '';

  if (typeof cleanSerie === 'string' && cleanSerie.includes(METER_META_PREFIX)) {
    const [visibleSerie, encoded] = cleanSerie.split(METER_META_PREFIX);
    cleanSerie = visibleSerie.trim();
    try {
      const parsed = JSON.parse(encoded);
      esTrifasico = Boolean(parsed.t);
      if (Array.isArray(parsed.c) && parsed.c.length > 0) {
        codigosObis = parsed.c;
      }
    } catch {
      // ignore malformed tag
    }
  }

  if (meter.tipo !== 'luz') {
    esTrifasico = false;
    codigosObis = null;
  } else if (esTrifasico && (!codigosObis || codigosObis.length === 0)) {
    codigosObis = DEFAULT_TRIFASICO_CODES;
  }

  return {
    ...meter,
    numero_serie: cleanSerie || null,
    es_trifasico: esTrifasico,
    codigos_obis: esTrifasico ? codigosObis : null,
  };
}

export function encodeMeterSerieFallback(numeroSerie, esTrifasico, codigosObis) {
  const clean = (numeroSerie || '').split(METER_META_PREFIX)[0].trim();
  if (!esTrifasico) return clean || null;
  const payload = JSON.stringify({
    t: 1,
    c: Array.isArray(codigosObis) && codigosObis.length > 0 ? codigosObis : DEFAULT_TRIFASICO_CODES,
  });
  return `${clean}${clean ? ' ' : ''}${METER_META_PREFIX}${payload}`;
}

/**
 * Extrae las lecturas por código OBIS de un registro (desde columna JSONB lecturas_obis
 * o desde metadatos embebidos en observaciones si aún no se corrió la migración SQL).
 */
export function normalizeReadingObis(reading) {
  if (!reading) return reading;

  let lecturasObis =
    reading.lecturas_obis && typeof reading.lecturas_obis === 'object'
      ? reading.lecturas_obis
      : null;
  let cleanObs = reading.observaciones || '';

  if (typeof cleanObs === 'string' && cleanObs.includes(READING_META_PREFIX)) {
    const [visibleObs, encoded] = cleanObs.split(READING_META_PREFIX);
    cleanObs = visibleObs.trim();
    if (!lecturasObis) {
      try {
        lecturasObis = JSON.parse(encoded);
      } catch {
        // ignore
      }
    }
  }

  return {
    ...reading,
    observaciones: cleanObs || null,
    lecturas_obis: lecturasObis,
  };
}

export function encodeReadingObsFallback(observaciones, lecturasObis) {
  const clean = (observaciones || '').split(READING_META_PREFIX)[0].trim();
  if (!lecturasObis || Object.keys(lecturasObis).length === 0) {
    return clean || null;
  }
  return `${clean}${clean ? ' ' : ''}${READING_META_PREFIX}${JSON.stringify(lecturasObis)}`;
}
