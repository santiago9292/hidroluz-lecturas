import { differenceInCalendarDays, parseISO } from 'date-fns';
import { DEFAULT_TRIFASICO_CODES } from './obis';

/**
 * Calcula la lectura equivalente de energía activa para medidores trifásicos
 * sumando únicamente los códigos OBIS marcados con `sumaConsumo !== false` (ej. 1.8.1 + 1.8.2).
 */
export function sumTrifasicoEnergy(obisValues = {}, codigosObis = DEFAULT_TRIFASICO_CODES) {
  const energyCodes = (codigosObis || DEFAULT_TRIFASICO_CODES).filter(
    (c) => c.sumaConsumo !== false
  );
  const total = energyCodes.reduce((acc, item) => {
    const v = Number(obisValues[item.code]);
    return acc + (Number.isNaN(v) ? 0 : v);
  }, 0);
  return Number(total.toFixed(2));
}

/**
 * Calcula el consumo del periodo, consumo diario promedio y detecta
 * excesos sobre umbral configurado, excesos sobre promedio (+30%) o
 * lecturas menores a la anterior (tanto monofásico como por código OBIS de energía).
 */
export function evaluateReadingConsumption({
  valorLectura,
  obisValues = null,
  fechaLectura = new Date().toISOString(),
  meter,
  previousReadings = [],
}) {
  const isTrifasico = Boolean(meter?.es_trifasico && meter?.tipo === 'luz');
  const codigosObis = meter?.codigos_obis || DEFAULT_TRIFASICO_CODES;

  const numValor = isTrifasico && obisValues
    ? sumTrifasicoEnergy(obisValues, codigosObis)
    : Number(valorLectura);

  const sortedPrev = [...previousReadings].sort(
    (a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime()
  );

  const latest = sortedPrev[0] || null;
  if (!latest) {
    return {
      valorCalculado: numValor,
      lecturaAnterior: null,
      diasTranscurridos: 1,
      consumoTotalPeriodo: 0,
      consumoDiario: 0,
      desgloseObis: null,
      promedioPrevio: null,
      esAnomalo: false,
      tipoAlerta: null,
      severidad: 'media',
      motivoAnomalia: null,
    };
  }

  const currentDate = typeof fechaLectura === 'string' ? parseISO(fechaLectura) : fechaLectura;
  const prevDate = parseISO(latest.fecha_lectura);
  const rawDays = differenceInCalendarDays(currentDate, prevDate);
  const diasTranscurridos = Math.max(1, rawDays);

  const lecturaAnterior = Number(latest.valor_lectura);

  // Si es trifásico y la lectura previa también tiene desglose OBIS, verificamos código por código de energía (1.8.1, 1.8.2)
  let rollbackReason = null;
  const desgloseObis = {};

  if (isTrifasico && obisValues) {
    const prevObis = latest.lecturas_obis || null;
    for (const cfg of codigosObis) {
      const currVal = Number(obisValues[cfg.code] ?? 0);
      const prevVal =
        prevObis && prevObis[cfg.code] !== undefined ? Number(prevObis[cfg.code]) : null;
      const diff = prevVal !== null ? Number((currVal - prevVal).toFixed(2)) : null;
      desgloseObis[cfg.code] = {
        actual: currVal,
        anterior: prevVal,
        variacion: diff,
        sumaConsumo: cfg.sumaConsumo !== false,
      };

      // Solo los códigos acumulativos de energía (1.8.1, 1.8.2) validan no retroceso;
      // 1.6.1 y 1.6.2.1 pueden reiniciarse cada mes sin ser error.
      if (cfg.sumaConsumo !== false && prevVal !== null && currVal < prevVal && !rollbackReason) {
        rollbackReason = `El Código ${cfg.code} actual (${currVal} ${cfg.unit || 'kWh'}) es menor a la lectura anterior (${prevVal} ${cfg.unit || 'kWh'}).`;
      }
    }
  }

  const consumoTotalPeriodo = Number((numValor - lecturaAnterior).toFixed(2));
  const consumoDiario = Number((consumoTotalPeriodo / diasTranscurridos).toFixed(2));

  const validHistoricals = sortedPrev
    .filter((r) => Number(r.consumo_diario) > 0 && Number(r.valor_lectura) >= 0)
    .slice(0, 7);

  const promedioPrevio =
    validHistoricals.length > 0
      ? Number(
          (
            validHistoricals.reduce((acc, item) => acc + Number(item.consumo_diario), 0) /
            validHistoricals.length
          ).toFixed(2)
        )
      : null;

  // 1. Anomalía crítica: retroceso en un código OBIS de energía o en lectura total
  if (rollbackReason || numValor < lecturaAnterior) {
    return {
      valorCalculado: numValor,
      lecturaAnterior,
      diasTranscurridos,
      consumoTotalPeriodo,
      consumoDiario,
      desgloseObis: isTrifasico ? desgloseObis : null,
      promedioPrevio,
      esAnomalo: true,
      tipoAlerta: 'lectura_menor',
      severidad: 'alta',
      motivoAnomalia:
        rollbackReason ||
        `Lectura acumulada (${numValor} ${meter.unidad}) es menor a la anterior (${lecturaAnterior} ${meter.unidad}). Verifique posible error de digitación.`,
    };
  }

  const reasons = [];
  let primaryAlert = null;
  let severidad = 'media';

  const maxThreshold =
    meter.umbral_diario_max !== null &&
    meter.umbral_diario_max !== undefined &&
    meter.umbral_diario_max !== ''
      ? Number(meter.umbral_diario_max)
      : null;

  // 2. Exceso sobre umbral diario máximo configurado
  if (maxThreshold !== null && maxThreshold > 0 && consumoDiario > maxThreshold) {
    const pctOver = Math.round(((consumoDiario - maxThreshold) / maxThreshold) * 100);
    primaryAlert = 'exceso_umbral';
    severidad = 'alta';
    reasons.push(
      `Consumo diario (${consumoDiario} ${meter.unidad}/día) supera el límite máximo de ${maxThreshold} ${meter.unidad}/día (+${pctOver}%).`
    );
  }

  // 3. Exceso estadístico sobre promedio reciente (+30% por defecto)
  const pctLimit = Number(meter.porcentaje_alerta_promedio || 30);
  if (promedioPrevio !== null && promedioPrevio > 0 && validHistoricals.length >= 2) {
    const allowedAvgMax = promedioPrevio * (1 + pctLimit / 100);
    if (consumoDiario > allowedAvgMax) {
      const pctAboveAvg = Math.round(((consumoDiario - promedioPrevio) / promedioPrevio) * 100);
      if (!primaryAlert) {
        primaryAlert = pctAboveAvg >= 100 ? 'salto_extremo' : 'exceso_promedio';
        severidad = pctAboveAvg >= 60 ? 'alta' : 'media';
      }
      reasons.push(
        `Supera en +${pctAboveAvg}% el promedio diario reciente (${promedioPrevio} ${meter.unidad}/día).`
      );
    }
  }

  return {
    valorCalculado: numValor,
    lecturaAnterior,
    diasTranscurridos,
    consumoTotalPeriodo,
    consumoDiario,
    desgloseObis: isTrifasico ? desgloseObis : null,
    promedioPrevio,
    esAnomalo: reasons.length > 0,
    tipoAlerta: primaryAlert,
    severidad,
    motivoAnomalia: reasons.length > 0 ? reasons.join(' ') : null,
  };
}

export function sanitizeDni(dni = '') {
  return String(dni).replace(/[^0-9A-Za-z]/g, '').trim();
}
