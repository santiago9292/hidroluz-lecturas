import { differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Calcula el consumo del periodo, consumo diario promedio y detecta
 * automáticamente excesos sobre umbral configurado, excesos sobre promedio
 * histórico (+30% por defecto) o lecturas menores a la anterior.
 */
export function evaluateReadingConsumption({
  valorLectura,
  fechaLectura = new Date().toISOString(),
  meter,
  previousReadings = [],
}) {
  const numValor = Number(valorLectura);

  const sortedPrev = [...previousReadings].sort(
    (a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime()
  );

  const latest = sortedPrev[0] || null;
  if (!latest) {
    return {
      lecturaAnterior: null,
      diasTranscurridos: 1,
      consumoTotalPeriodo: 0,
      consumoDiario: 0,
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
  const consumoTotalPeriodo = Number((numValor - lecturaAnterior).toFixed(2));
  const consumoDiario = Number((consumoTotalPeriodo / diasTranscurridos).toFixed(2));

  // Promedio diario de hasta las últimas 7 lecturas válidas (> 0)
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

  // 1. Anomalía crítica: lectura actual menor que la anterior
  if (numValor < lecturaAnterior) {
    return {
      lecturaAnterior,
      diasTranscurridos,
      consumoTotalPeriodo,
      consumoDiario,
      promedioPrevio,
      esAnomalo: true,
      tipoAlerta: 'lectura_menor',
      severidad: 'alta',
      motivoAnomalia: `Lectura registrada (${numValor} ${meter.unidad}) es menor a la anterior (${lecturaAnterior} ${meter.unidad}). Posible error de digitación o reinicio de medidor.`,
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

  // 2. Exceso sobre umbral diario máximo configurado por sede/medidor
  if (maxThreshold !== null && maxThreshold > 0 && consumoDiario > maxThreshold) {
    const pctOver = Math.round(((consumoDiario - maxThreshold) / maxThreshold) * 100);
    primaryAlert = 'exceso_umbral';
    severidad = 'alta';
    reasons.push(
      `Consumo diario (${consumoDiario} ${meter.unidad}/día) supera el límite máximo de ${maxThreshold} ${meter.unidad}/día (+${pctOver}%).`
    );
  }

  // 3. Detección automática sobre el promedio reciente (+30% por defecto)
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
    lecturaAnterior,
    diasTranscurridos,
    consumoTotalPeriodo,
    consumoDiario,
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
