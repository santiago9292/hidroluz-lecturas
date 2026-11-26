/**
 * Configuración tarifaria OSINERGMIN, códigos OBIS (energía activa, demanda y reactiva)
 * y serialización retrocompatible con Supabase.
 */

export const TARIFF_OPTIONS = ['BT2', 'BT3', 'BT4', 'BT5', 'MT2', 'MT3', 'MT4', 'otra'];

/**
 * Matriz regulatoria OSINERGMIN Perú por defecto según tarifa seleccionada.
 * Todos estos switches siguen siendo editables manualmente por medidor en Admin.
 */
export function getTariffRuleDefaults(tarifa = 'BT5') {
  switch (tarifa) {
    case 'BT2':
    case 'MT2':
      return {
        usa_potencia_variable: true,
        aplica_calificacion: false,
        cobra_reactiva: true,
      };
    case 'BT3':
    case 'BT4':
    case 'MT3':
    case 'MT4':
      return {
        usa_potencia_variable: true,
        aplica_calificacion: true,
        cobra_reactiva: true,
      };
    case 'BT5':
      return {
        usa_potencia_variable: false,
        aplica_calificacion: false,
        cobra_reactiva: false,
      };
    case 'otra':
    default:
      return {
        usa_potencia_variable: false,
        aplica_calificacion: false,
        cobra_reactiva: false,
      };
  }
}

export const DEFAULT_ALERT_THRESHOLDS = {
  consumo_ambar_pct: 20,
  consumo_roja_pct: 40,
  min_muestras_mismo_dia: 3,
  demanda_ambar_pct: 90,
  calificacion_umbral: 0.5,
  calificacion_banda_min: 0.45,
  calificacion_banda_max: 0.55,
  reactiva_ambar_pct: 27,
  reactiva_roja_pct: 30,
  salto_confirmacion_multiplo: 3,
  horas_sin_lectura_aviso: 24,
};

export function buildDefaultTariffConfig(tipo = 'luz', esTrifasico = false) {
  if (tipo !== 'luz') {
    return {
      tarifa: 'AGUA',
      factor_energia: 1,
      factor_demanda: 1,
      dia_corte: 1,
      ventana_corte_dias: 3,
      dias_laborables: [1, 2, 3, 4, 5, 6],
      usar_feriados_peru: true,
      feriados_extra: [],
      umbrales: { ...DEFAULT_ALERT_THRESHOLDS },
    };
  }

  const tarifaInicial = esTrifasico ? 'BT3' : 'BT5';
  const rules = getTariffRuleDefaults(tarifaInicial);

  return {
    tarifa: tarifaInicial,
    factor_energia: 1,
    factor_demanda: 1,
    dia_corte: 1,
    ventana_corte_dias: 3,
    // IMPORTANTE: nunca asumir qué tarifa (T1 o T2) es Hora Punta (HP)
    hp_registro: 'sin_asignar', // 'sin_asignar' | 'T1' | 'T2'
    hp_inicio: '18:00',
    hp_fin: '23:00',
    excluir_domingos_hp: true,
    excluir_feriados_hp: true,
    usar_feriados_peru: true,
    feriados_extra: [],
    dias_laborables: [1, 2, 3, 4, 5, 6],
    // Significado de 1.6.2.1: 'historico' pide 1.6.2 y no usa 1.6.2.1 como demanda del mes
    modo_1621: 'historico', // 'historico' | 'actual'
    registrar_1621_historico: false,
    usa_reactiva_obis: false,
    codigo_reactiva: '3.8.0',
    ...rules,
    umbrales: { ...DEFAULT_ALERT_THRESHOLDS },
  };
}

/**
 * Construye dinámicamente los campos OBIS que debe mostrar el formulario de registro
 * respetando la asignación HP/HFP, el rol de 1.6.2.1 (histórico vs actual) y reactiva opcional.
 */
export function getActiveObisFieldsForMeter(meter) {
  const cfg = normalizeMeterConfig(meter);
  const hpReg = cfg.hp_registro;

  const t1Suffix =
    hpReg === 'T1' ? 'HP (T1)' : hpReg === 'T2' ? 'HFP (T1)' : 'Tarifa 1 (definir HP/HFP)';
  const t2Suffix =
    hpReg === 'T2' ? 'HP (T2)' : hpReg === 'T1' ? 'HFP (T2)' : 'Tarifa 2 (definir HP/HFP)';

  const fields = [
    {
      code: '1.8.1',
      label: `Energía ${t1Suffix}`,
      unit: 'kWh',
      role: 'energia_t1',
      sumaConsumo: true,
      required: true,
    },
    {
      code: '1.8.2',
      label: `Energía ${t2Suffix}`,
      unit: 'kWh',
      role: 'energia_t2',
      sumaConsumo: true,
      required: true,
    },
    {
      code: '1.6.1',
      label: `Demanda Máx. ${t1Suffix}`,
      unit: 'kW',
      role: 'demanda_t1',
      sumaConsumo: false,
      required: true,
    },
  ];

  if (cfg.modo_1621 === 'actual') {
    fields.push({
      code: '1.6.2.1',
      label: `Demanda Máx. ${t2Suffix}`,
      unit: 'kW',
      role: 'demanda_t2',
      sumaConsumo: false,
      required: true,
    });
  } else {
    // Si 1.6.2.1 es histórico, se pide obligatoriamente 1.6.2 como demanda del periodo
    fields.push({
      code: '1.6.2',
      label: `Demanda Máx. ${t2Suffix}`,
      unit: 'kW',
      role: 'demanda_t2',
      sumaConsumo: false,
      required: true,
    });
    if (cfg.registrar_1621_historico) {
      fields.push({
        code: '1.6.2.1',
        label: 'Cierre Histórico 1.6.2.1 (informativo)',
        unit: 'kW',
        role: 'demanda_historica',
        sumaConsumo: false,
        required: false,
      });
    }
  }

  if (cfg.usa_reactiva_obis) {
    const reactiveCode = (cfg.codigo_reactiva || '3.8.0').trim();
    fields.push({
      code: reactiveCode,
      label: 'Energía Reactiva Acum.',
      unit: 'kVARh',
      role: 'reactiva',
      sumaConsumo: false,
      required: false,
    });
  }

  // Agregar códigos personalizados extra que no colisionen con los estándar
  const standardSet = new Set(fields.map((f) => f.code));
  if (Array.isArray(meter?.codigos_obis)) {
    meter.codigos_obis.forEach((custom) => {
      if (
        custom?.code &&
        !standardSet.has(custom.code) &&
        !['1.6.2', '1.6.2.1', '3.8.0'].includes(custom.code)
      ) {
        fields.push({
          code: custom.code,
          label: custom.label || `Código ${custom.code}`,
          unit: custom.unit || 'kWh',
          role: 'extra',
          sumaConsumo: Boolean(custom.sumaConsumo),
          required: false,
        });
      }
    });
  }

  return fields;
}

export const DEFAULT_TRIFASICO_CODES = [
  { code: '1.8.1', label: 'Energía T1', unit: 'kWh', sumaConsumo: true },
  { code: '1.8.2', label: 'Energía T2', unit: 'kWh', sumaConsumo: true },
  { code: '1.6.1', label: 'Demanda T1', unit: 'kW', sumaConsumo: false },
  { code: '1.6.2', label: 'Demanda T2', unit: 'kW', sumaConsumo: false },
];

const METER_META_V2 = '__MCFG2__:';
const METER_META_LEGACY = '__OBISCFG__:';
const READING_META_V2 = '__RDAT2__:';
const READING_META_LEGACY = '__OBISVAL__:';

export function normalizeMeterConfig(meter) {
  const defaults = buildDefaultTariffConfig(meter?.tipo || 'luz', Boolean(meter?.es_trifasico));
  const rawCfg =
    meter?.config_tarifaria && typeof meter.config_tarifaria === 'object'
      ? meter.config_tarifaria
      : {};

  return {
    ...defaults,
    ...rawCfg,
    factor_energia:
      Number(rawCfg.factor_energia) > 0 ? Number(rawCfg.factor_energia) : defaults.factor_energia,
    factor_demanda:
      Number(rawCfg.factor_demanda) > 0 ? Number(rawCfg.factor_demanda) : defaults.factor_demanda,
    dia_corte:
      Number(rawCfg.dia_corte) >= 1 && Number(rawCfg.dia_corte) <= 31
        ? Math.floor(Number(rawCfg.dia_corte))
        : defaults.dia_corte,
    ventana_corte_dias:
      rawCfg.ventana_corte_dias !== undefined && rawCfg.ventana_corte_dias !== ''
        ? Math.max(0, Number(rawCfg.ventana_corte_dias))
        : defaults.ventana_corte_dias,
    umbrales: {
      ...DEFAULT_ALERT_THRESHOLDS,
      ...(rawCfg.umbrales || {}),
    },
  };
}

export function normalizeMeterObis(meter) {
  if (!meter) return meter;

  let esTrifasico = Boolean(meter.es_trifasico);
  let codigosObis = Array.isArray(meter.codigos_obis) ? meter.codigos_obis : null;
  let configTarifaria =
    meter.config_tarifaria && typeof meter.config_tarifaria === 'object'
      ? meter.config_tarifaria
      : null;
  let cleanSerie = meter.numero_serie || '';

  if (typeof cleanSerie === 'string' && cleanSerie.includes(METER_META_V2)) {
    const [visibleSerie, encoded] = cleanSerie.split(METER_META_V2);
    cleanSerie = visibleSerie.trim();
    try {
      const parsed = JSON.parse(encoded);
      esTrifasico = Boolean(parsed.t);
      if (Array.isArray(parsed.c)) codigosObis = parsed.c;
      if (parsed.cfg && typeof parsed.cfg === 'object') {
        configTarifaria = { ...parsed.cfg, ...(configTarifaria || {}) };
      }
    } catch {
      // ignore
    }
  } else if (typeof cleanSerie === 'string' && cleanSerie.includes(METER_META_LEGACY)) {
    const [visibleSerie, encoded] = cleanSerie.split(METER_META_LEGACY);
    cleanSerie = visibleSerie.trim();
    try {
      const parsed = JSON.parse(encoded);
      esTrifasico = Boolean(parsed.t);
      if (Array.isArray(parsed.c) && parsed.c.length > 0) {
        codigosObis = parsed.c;
      }
    } catch {
      // ignore
    }
  }

  if (meter.tipo !== 'luz') {
    esTrifasico = false;
    codigosObis = null;
  }

  const normalizedCfg = normalizeMeterConfig({
    ...meter,
    es_trifasico: esTrifasico,
    config_tarifaria: configTarifaria,
  });

  return {
    ...meter,
    numero_serie: cleanSerie || null,
    es_trifasico: esTrifasico,
    codigos_obis: esTrifasico ? codigosObis || DEFAULT_TRIFASICO_CODES : null,
    config_tarifaria: normalizedCfg,
  };
}

export function encodeMeterSerieFallback(numeroSerie, esTrifasico, codigosObis, configTarifaria) {
  const clean = String(numeroSerie || '')
    .split(METER_META_V2)[0]
    .split(METER_META_LEGACY)[0]
    .trim();
  const payload = JSON.stringify({
    t: esTrifasico ? 1 : 0,
    c: esTrifasico ? codigosObis || [] : null,
    cfg: configTarifaria || null,
  });
  return `${clean}${clean ? ' ' : ''}${METER_META_V2}${payload}`;
}

export function normalizeReadingObis(reading) {
  if (!reading) return reading;

  let lecturasObis =
    reading.lecturas_obis && typeof reading.lecturas_obis === 'object'
      ? reading.lecturas_obis
      : null;
  let valorCrudo =
    reading.valor_crudo !== undefined && reading.valor_crudo !== null
      ? Number(reading.valor_crudo)
      : reading.valor_lectura !== undefined && reading.valor_lectura !== null
      ? Number(reading.valor_lectura)
      : null;
  let calculos =
    reading.calculos && typeof reading.calculos === 'object' ? reading.calculos : null;
  let eventoLectura = reading.evento_lectura || null;
  let cleanObs = reading.observaciones || '';

  if (typeof cleanObs === 'string' && cleanObs.includes(READING_META_V2)) {
    const [visibleObs, encoded] = cleanObs.split(READING_META_V2);
    cleanObs = visibleObs.trim();
    try {
      const parsed = JSON.parse(encoded);
      if (!lecturasObis && parsed.obis) lecturasObis = parsed.obis;
      if (parsed.raw !== undefined && parsed.raw !== null) valorCrudo = Number(parsed.raw);
      if (!calculos && parsed.calc) calculos = parsed.calc;
      if (!eventoLectura && parsed.ev) eventoLectura = parsed.ev;
    } catch {
      // ignore
    }
  } else if (typeof cleanObs === 'string' && cleanObs.includes(READING_META_LEGACY)) {
    const [visibleObs, encoded] = cleanObs.split(READING_META_LEGACY);
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
    valor_crudo: valorCrudo,
    lecturas_obis: lecturasObis,
    calculos,
    evento_lectura: eventoLectura,
  };
}

export function encodeReadingObsFallback(
  observaciones,
  { lecturasObis = null, valorCrudo = null, calculos = null, eventoLectura = null } = {}
) {
  const clean = String(observaciones || '')
    .split(READING_META_V2)[0]
    .split(READING_META_LEGACY)[0]
    .trim();
  const payload = JSON.stringify({
    obis: lecturasObis,
    raw: valorCrudo,
    calc: calculos,
    ev: eventoLectura,
  });
  return `${clean}${clean ? ' ' : ''}${READING_META_V2}${payload}`;
}
