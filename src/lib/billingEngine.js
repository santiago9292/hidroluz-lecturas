import { countPeakHoursInRange, isWorkday } from './peruHolidays';
import { normalizeMeterConfig, normalizeMeterObis, normalizeReadingObis } from './obis';

function round2(n) {
  return Number(Number(n || 0).toFixed(2));
}

function round3(n) {
  return Number(Number(n || 0).toFixed(3));
}

function round4(n) {
  return Number(Number(n || 0).toFixed(4));
}

function toDate(d) {
  return d instanceof Date ? d : new Date(d);
}

/**
 * Construye una fecha de corte segura ajustando al último día del mes si el mes tiene menos días.
 */
export function buildCutDate(year, monthIndex, diaCorte = 1) {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, Math.floor(diaCorte)), maxDay);
  return new Date(year, monthIndex, safeDay, 0, 0, 0, 0);
}

/**
 * Determina el periodo de facturación [start, end) correspondiente a una fecha según `diaCorte`.
 */
export function getBillingPeriodBounds(dateInput, diaCorte = 1) {
  const d = toDate(dateInput);
  const currentMonthCut = buildCutDate(d.getFullYear(), d.getMonth(), diaCorte);

  let start;
  let end;
  if (d >= currentMonthCut) {
    start = currentMonthCut;
    end = buildCutDate(d.getFullYear(), d.getMonth() + 1, diaCorte);
  } else {
    start = buildCutDate(d.getFullYear(), d.getMonth() - 1, diaCorte);
    end = currentMonthCut;
  }

  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-D${String(
    diaCorte
  ).padStart(2, '0')}`;

  return { key, start, end, diaCorte };
}

/**
 * Verifica si una fecha está dentro de la ventana cercana al día de corte (±ventanaDias).
 */
export function isNearBillingCut(dateInput, diaCorte = 1, ventanaDias = 3) {
  const d = toDate(dateInput);
  const { start, end } = getBillingPeriodBounds(d, diaCorte);
  const msWindow = Math.max(0, Number(ventanaDias)) * 86400000;
  const distToStart = Math.abs(d.getTime() - start.getTime());
  const distToEnd = Math.abs(end.getTime() - d.getTime());
  return Math.min(distToStart, distToEnd) <= msWindow;
}

/**
 * Extrae las demandas crudas de T1 y T2 respetando `modo_1621` ('historico' vs 'actual').
 * Si `1.6.2.1` es histórico, jamás se usa como demanda del mes y se exige `1.6.2`.
 */
export function extractRawObisValues(obisValues = {}, cfg) {
  const getNum = (key) => {
    const raw = obisValues?.[key];
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  };

  const eT1 = getNum('1.8.1');
  const eT2 = getNum('1.8.2');
  const dT1 = getNum('1.6.1');
  const dT2 = cfg.modo_1621 === 'actual' ? getNum('1.6.2.1') : getNum('1.6.2');
  const dHistorica1621 = cfg.modo_1621 === 'historico' ? getNum('1.6.2.1') : null;

  const reactiveCode = (cfg.codigo_reactiva || '3.8.0').trim();
  const eReactiva = getNum(reactiveCode);

  return {
    eT1,
    eT2,
    dT1,
    dT2,
    d2CodeUsed: cfg.modo_1621 === 'actual' ? '1.6.2.1' : '1.6.2',
    dHistorica1621,
    eReactiva,
    reactiveCode,
  };
}

function calcRegisterDelta(curr, prev, factor, confirmation = null) {
  if (curr === null || curr === undefined) return null;
  if (prev === null || prev === undefined) return 0;
  if (confirmation?.motivoEnergiaMenor === 'cambio_medidor') {
    return 0;
  }
  if (curr < prev && confirmation?.motivoEnergiaMenor === 'vuelta_cero') {
    const tope = Number(confirmation?.topeMedidor || 0);
    if (tope > prev) {
      return round4((tope - prev + curr) * factor);
    }
    return round4(curr * factor);
  }
  return round4((curr - prev) * factor);
}

/**
 * Calcula un tramo individual entre `previousReading` y la lectura actual sin alterar el valor crudo.
 * NUNCA suma acumulados como si fueran consumo: Consumo Total = Consumo HP + Consumo HFP.
 */
export function calculateReadingStep({
  valorCrudo = null,
  obisValues = null,
  fechaLectura = new Date().toISOString(),
  meter,
  previousReading = null,
  confirmation = null,
}) {
  const normMeter = normalizeMeterObis(meter);
  const cfg = normalizeMeterConfig(normMeter);
  const isLuz = normMeter.tipo === 'luz';
  const isTrifasico = Boolean(isLuz && normMeter.es_trifasico);

  const factorE = isLuz ? cfg.factor_energia : 1;
  const factorD = isLuz ? cfg.factor_demanda : 1;

  const currDate = toDate(fechaLectura);
  const prevNorm = previousReading ? normalizeReadingObis(previousReading) : null;
  const prevDate = prevNorm ? toDate(prevNorm.fecha_lectura) : null;

  const horasTranscurridas =
    prevDate && currDate > prevDate ? (currDate.getTime() - prevDate.getTime()) / 3600000 : null;

  const period = getBillingPeriodBounds(currDate, cfg.dia_corte);

  // CASO 1: MEDIDOR TRIFÁSICO (OBIS)
  if (isTrifasico) {
    const currRaw = extractRawObisValues(obisValues || {}, cfg);
    const prevRaw =
      prevNorm && prevNorm.lecturas_obis
        ? extractRawObisValues(prevNorm.lecturas_obis, cfg)
        : null;

    const deltaT1 = prevRaw
      ? calcRegisterDelta(currRaw.eT1, prevRaw.eT1, factorE, confirmation)
      : 0;
    const deltaT2 = prevRaw
      ? calcRegisterDelta(currRaw.eT2, prevRaw.eT2, factorE, confirmation)
      : 0;

    const consumoT1 = round2(deltaT1 ?? 0);
    const consumoT2 = round2(deltaT2 ?? 0);

    const demandaT1 = currRaw.dT1 !== null ? round2(currRaw.dT1 * factorD) : null;
    const demandaT2 = currRaw.dT2 !== null ? round2(currRaw.dT2 * factorD) : null;

    let consumoHP = null;
    let consumoHFP = null;
    let demandaHP = null;
    let demandaHFP = null;

    if (cfg.hp_registro === 'T1') {
      consumoHP = consumoT1;
      consumoHFP = consumoT2;
      demandaHP = demandaT1;
      demandaHFP = demandaT2;
    } else if (cfg.hp_registro === 'T2') {
      consumoHP = consumoT2;
      consumoHFP = consumoT1;
      demandaHP = demandaT2;
      demandaHFP = demandaT1;
    }

    // Consumo total = HP + HFP (equivalente a deltaT1 + deltaT2, jamás suma de acumulados)
    const consumoTotal =
      consumoHP !== null && consumoHFP !== null
        ? round2(consumoHP + consumoHFP)
        : round2(consumoT1 + consumoT2);

    const promedioDiario =
      horasTranscurridas && horasTranscurridas > 0
        ? round2((consumoTotal / horasTranscurridas) * 24)
        : 0;

    let consumoReactiva = null;
    if (currRaw.eReactiva !== null) {
      consumoReactiva =
        prevRaw && prevRaw.eReactiva !== null
          ? round2(calcRegisterDelta(currRaw.eReactiva, prevRaw.eReactiva, factorE, confirmation))
          : 0;
    }

    const reactivaExcedenteTramo =
      cfg.cobra_reactiva && consumoReactiva !== null
        ? round2(Math.max(0, consumoReactiva - (cfg.umbrales.reactiva_roja_pct / 100) * consumoTotal))
        : 0;

    const demandaMaxLectura =
      demandaT1 !== null || demandaT2 !== null
        ? round2(Math.max(demandaT1 ?? 0, demandaT2 ?? 0))
        : null;

    // Detectar si alguna demanda bajó respecto a la lectura inmediata anterior
    let demandaBajo = false;
    const detallesBajaDemanda = [];
    if (prevRaw) {
      if (currRaw.dT1 !== null && prevRaw.dT1 !== null && currRaw.dT1 < prevRaw.dT1) {
        demandaBajo = true;
        detallesBajaDemanda.push(`1.6.1 (${prevRaw.dT1} → ${currRaw.dT1})`);
      }
      if (currRaw.dT2 !== null && prevRaw.dT2 !== null && currRaw.dT2 < prevRaw.dT2) {
        demandaBajo = true;
        detallesBajaDemanda.push(`${currRaw.d2CodeUsed} (${prevRaw.dT2} → ${currRaw.dT2})`);
      }
    }

    const cercaDelCorte = isNearBillingCut(currDate, cfg.dia_corte, cfg.ventana_corte_dias);
    const abreNuevoPeriodoDemanda = Boolean(demandaBajo && cercaDelCorte);

    return {
      isTrifasico: true,
      hpSinAsignar: cfg.hp_registro === 'sin_asignar',
      periodoKey: period.key,
      factorEnergia: factorE,
      factorDemanda: factorD,
      horasTranscurridas: horasTranscurridas !== null ? round2(horasTranscurridas) : null,
      diasEquivalentes:
        horasTranscurridas !== null ? round2(horasTranscurridas / 24) : prevNorm ? 1 : 0,
      consumoT1,
      consumoT2,
      consumoHP,
      consumoHFP,
      consumoTotal,
      promedioDiario,
      consumoReactiva,
      reactivaExcedenteTramo,
      demandaT1,
      demandaT2,
      demandaHP,
      demandaHFP,
      demandaMaxLectura,
      demandaBajo,
      detallesBajaDemanda,
      cercaDelCorte,
      abreNuevoPeriodoDemanda,
      // Valor crudo representativo sin inventar suma de acumulados: guardamos T1 crudo en columna legacy
      // y el mapa crudo exacto íntegro en `lecturas_obis`
      valorCrudoPrimario: currRaw.eT1 ?? 0,
      prevValorCrudoPrimario: prevRaw?.eT1 ?? null,
    };
  }

  // CASO 2: MONOFÁSICO LUZ O AGUA (m³ con hasta 3 decimales exactos)
  const roundFn = isLuz ? round2 : round3;
  const rawCurrNum = roundFn(Number(valorCrudo ?? 0));
  const rawPrevNum =
    prevNorm && prevNorm.valor_crudo !== null && prevNorm.valor_crudo !== undefined
      ? Number(prevNorm.valor_crudo)
      : prevNorm && prevNorm.valor_lectura !== null && prevNorm.valor_lectura !== undefined
      ? Number(prevNorm.valor_lectura)
      : null;

  const deltaScaled =
    rawPrevNum !== null ? calcRegisterDelta(rawCurrNum, rawPrevNum, factorE, confirmation) : 0;
  const consumoTotal = roundFn(deltaScaled ?? 0);
  const promedioDiario =
    horasTranscurridas && horasTranscurridas > 0
      ? roundFn((consumoTotal / horasTranscurridas) * 24)
      : 0;

  return {
    isTrifasico: false,
    hpSinAsignar: false,
    periodoKey: period.key,
    factorEnergia: factorE,
    factorDemanda: 1,
    horasTranscurridas: horasTranscurridas !== null ? round2(horasTranscurridas) : null,
    diasEquivalentes:
      horasTranscurridas !== null ? round2(horasTranscurridas / 24) : prevNorm ? 1 : 0,
    consumoT1: null,
    consumoT2: null,
    consumoHP: null,
    consumoHFP: null,
    consumoTotal,
    promedioDiario,
    consumoReactiva: null,
    reactivaExcedenteTramo: 0,
    demandaT1: null,
    demandaT2: null,
    demandaHP: null,
    demandaHFP: null,
    demandaMaxLectura: null,
    demandaBajo: false,
    detallesBajaDemanda: [],
    cercaDelCorte: isNearBillingCut(currDate, cfg.dia_corte, cfg.ventana_corte_dias),
    abreNuevoPeriodoDemanda: false,
    valorCrudoPrimario: rawCurrNum,
    prevValorCrudoPrimario: rawPrevNum,
  };
}

/**
 * 4. VALIDACIONES ANTES DE GUARDAR
 * - Energía menor que la anterior: bloquea y pide confirmación (error de digitación, cambio de medidor o vuelta a cero).
 * - Demanda que baja cerca del corte: reinicio normal, abre periodo nuevo.
 * - Demanda que baja a mitad de periodo: bloquea y pide revisión.
 * - Salto de más de 3 veces el promedio: bloquea y exige confirmar dígitos y foto.
 */
export function validateReadingBeforeSave({
  valorCrudo = null,
  obisValues = null,
  fechaLectura = new Date().toISOString(),
  meter,
  previousReadings = [],
  hasMedia = false,
  confirmation = {},
}) {
  const normMeter = normalizeMeterObis(meter);
  const cfg = normalizeMeterConfig(normMeter);
  const isLuz = normMeter.tipo === 'luz';
  const isTrifasico = Boolean(isLuz && normMeter.es_trifasico);

  const sortedPrev = [...previousReadings]
    .map(normalizeReadingObis)
    .sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime());
  const latest = sortedPrev[0] || null;

  const blockingIssues = [];
  const notices = [];

  if (latest && toDate(fechaLectura) <= toDate(latest.fecha_lectura)) {
    blockingIssues.push({
      type: 'fecha_invalida',
      requiresConfirmation: false,
      title: 'Fecha y hora anterior o igual al último registro',
      message: `La fecha de lectura debe ser posterior al último registro (${new Date(
        latest.fecha_lectura
      ).toLocaleString('es-PE')}).`,
    });
    return { valid: false, blockingIssues, notices, step: null };
  }

  // Verificar campos requeridos y lecturas de energía menores a la anterior
  const energyDrops = [];

  if (isTrifasico) {
    const currRaw = extractRawObisValues(obisValues || {}, cfg);
    if (currRaw.eT1 === null || currRaw.eT1 < 0) {
      blockingIssues.push({
        type: 'campo_requerido',
        requiresConfirmation: false,
        title: 'Falta Código 1.8.1',
        message: 'Ingresa el valor crudo acumulado del Código 1.8.1.',
      });
    }
    if (currRaw.eT2 === null || currRaw.eT2 < 0) {
      blockingIssues.push({
        type: 'campo_requerido',
        requiresConfirmation: false,
        title: 'Falta Código 1.8.2',
        message: 'Ingresa el valor crudo acumulado del Código 1.8.2.',
      });
    }
    if (currRaw.dT1 === null || currRaw.dT1 < 0) {
      blockingIssues.push({
        type: 'campo_requerido',
        requiresConfirmation: false,
        title: 'Falta Código 1.6.1',
        message: 'Ingresa la demanda máxima del Código 1.6.1.',
      });
    }
    if (currRaw.dT2 === null || currRaw.dT2 < 0) {
      blockingIssues.push({
        type: 'campo_requerido',
        requiresConfirmation: false,
        title:
          cfg.modo_1621 === 'historico'
            ? 'Se requiere Código 1.6.2 (1.6.2.1 está configurado como histórico)'
            : 'Falta Código 1.6.2.1',
        message:
          cfg.modo_1621 === 'historico'
            ? 'El registro 1.6.2.1 está marcado como histórico; ingresa la demanda actual en el Código 1.6.2.'
            : 'Ingresa la demanda máxima del Código 1.6.2.1.',
      });
    }

    if (blockingIssues.length > 0) {
      return { valid: false, blockingIssues, notices, step: null };
    }

    if (latest?.lecturas_obis) {
      const prevRaw = extractRawObisValues(latest.lecturas_obis, cfg);
      if (prevRaw.eT1 !== null && currRaw.eT1 < prevRaw.eT1) {
        energyDrops.push(`1.8.1 (${prevRaw.eT1} → ${currRaw.eT1} kWh)`);
      }
      if (prevRaw.eT2 !== null && currRaw.eT2 < prevRaw.eT2) {
        energyDrops.push(`1.8.2 (${prevRaw.eT2} → ${currRaw.eT2} kWh)`);
      }
      if (
        currRaw.eReactiva !== null &&
        prevRaw.eReactiva !== null &&
        currRaw.eReactiva < prevRaw.eReactiva
      ) {
        energyDrops.push(
          `${currRaw.reactiveCode} (${prevRaw.eReactiva} → ${currRaw.eReactiva} kVARh)`
        );
      }
    }
  } else {
    if (valorCrudo === '' || valorCrudo === null || Number.isNaN(Number(valorCrudo)) || Number(valorCrudo) < 0) {
      blockingIssues.push({
        type: 'campo_requerido',
        requiresConfirmation: false,
        title: 'Lectura inválida',
        message: 'Ingresa un valor numérico crudo mayor o igual a 0.',
      });
      return { valid: false, blockingIssues, notices, step: null };
    }

    if (latest) {
      const prevVal = Number(latest.valor_crudo ?? latest.valor_lectura);
      if (Number(valorCrudo) < prevVal) {
        energyDrops.push(`${prevVal} → ${Number(valorCrudo)} ${normMeter.unidad}`);
      }
    }
  }

  // 1. Validación: Energía / Agua menor que la anterior
  const validDropReasons = ['cambio_medidor', 'vuelta_cero'];
  if (energyDrops.length > 0 && !validDropReasons.includes(confirmation?.motivoEnergiaMenor)) {
    blockingIssues.push({
      type: 'energia_menor',
      requiresConfirmation: true,
      title: 'Lectura acumulada menor que la anterior',
      message: `Se detectó disminución en registro acumulativo: ${energyDrops.join(
        ', '
      )}. Si es un error de digitación corrige el valor; si ocurrió en el medidor, confirma cambio de medidor o vuelta a cero.`,
      details: energyDrops,
    });
  }

  const step = calculateReadingStep({
    valorCrudo,
    obisValues,
    fechaLectura,
    meter: normMeter,
    previousReading: latest,
    confirmation,
  });

  if (step.hpSinAsignar) {
    notices.push({
      type: 'hp_sin_asignar',
      message:
        'Aún no se ha definido en Admin si T1 o T2 es Hora Punta (HP). Se guardarán los crudos y el consumo total sin asumir HP/HFP.',
    });
  }

  // 2. Validación: Demanda que baja (no aplica si se acaba de reemplazar el medidor físico)
  if (step.demandaBajo && confirmation?.motivoEnergiaMenor !== 'cambio_medidor') {
    if (step.cercaDelCorte) {
      notices.push({
        type: 'reinicio_demanda_corte',
        abreNuevoPeriodoDemanda: true,
        message: `Demanda menor cerca del día de corte (${cfg.dia_corte}): reinicio normal detectado (${step.detallesBajaDemanda.join(
          ', '
        )}). Se abre un nuevo periodo de facturación.`,
      });
    } else if (!confirmation?.confirmarBajaDemandaMitad) {
      blockingIssues.push({
        type: 'demanda_baja_mitad_periodo',
        requiresConfirmation: true,
        title: 'Demanda disminuyó a mitad del periodo',
        message: `La demanda bajó (${step.detallesBajaDemanda.join(
          ', '
        )}) fuera de la ventana del día de corte (día ${cfg.dia_corte} ±${
          cfg.ventana_corte_dias
        }d). Revisa si hubo error de digitación o confirma que el medidor fue reseteado.`,
      });
    }
  }

  // 3. Validación: Salto de más de 3 veces el promedio diario histórico
  const historicalRates = sortedPrev
    .map((r) => Number(r.calculos?.promedioDiario ?? r.consumo_diario ?? 0))
    .filter((v) => v > 0)
    .slice(0, 14);

  if (historicalRates.length >= 2 && step.promedioDiario > 0) {
    const avgHist =
      historicalRates.reduce((acc, n) => acc + n, 0) / historicalRates.length;
    const mult = Number(cfg.umbrales.salto_confirmacion_multiplo || 3);

    if (step.promedioDiario > avgHist * mult) {
      const confirmedJump = Boolean(confirmation?.confirmarSalto && hasMedia);
      if (!confirmedJump) {
        blockingIssues.push({
          type: 'salto_extremo_confirmacion',
          requiresConfirmation: true,
          requiresMedia: true,
          title: `Salto mayor a ${mult}× el promedio diario`,
          message: `El promedio calculado (${step.promedioDiario} ${
            normMeter.unidad
          }/día) supera ${mult} veces el promedio habitual (${round2(avgHist)} ${
            normMeter.unidad
          }/día). Confirma que los dígitos son correctos y adjunta foto obligatoria del medidor.`,
        });
      }
    }
  }

  return {
    valid: blockingIssues.length === 0,
    blockingIssues,
    notices,
    step,
  };
}

/**
 * Agrupa todo el historial de lecturas de un medidor en periodos mensuales según `dia_corte`
 * (y aperturas de periodo por reinicio de demanda cerca del corte) y calcula:
 * - kWh HP, HFP y Total del periodo, proyección al corte
 * - Demandas del periodo por tarifa y Demanda Máxima del mes
 * - Potencia de distribución estimada (promedio de las 2 mayores demandas de los últimos 6 meses; solo HP para HP)
 * - Calificación tarifaria (>= 0.50 presente en punta; < 0.50 fuera de punta)
 * - Reactiva acumulada del periodo, % reactiva/activa y reactiva excedente (> 30% kWh)
 */
export function computePeriodAndTariffSummary({
  readings = [],
  meter,
  referenceDate = new Date(),
}) {
  const normMeter = normalizeMeterObis(meter);
  const cfg = normalizeMeterConfig(normMeter);
  const isLuz = normMeter.tipo === 'luz';
  const isTrifasico = Boolean(isLuz && normMeter.es_trifasico);

  const ascReadings = [...readings]
    .filter((r) => r.meter_id === normMeter.id || !r.meter_id)
    .map(normalizeReadingObis)
    .sort((a, b) => new Date(a.fecha_lectura).getTime() - new Date(b.fecha_lectura).getTime());

  // Construir mapa de periodos
  const periodsMap = new Map();
  let forcedShiftCounter = 0;

  ascReadings.forEach((r, idx) => {
    const prev = idx > 0 ? ascReadings[idx - 1] : null;
    const calc =
      r.calculos ||
      calculateReadingStep({
        valorCrudo: r.valor_crudo ?? r.valor_lectura,
        obisValues: r.lecturas_obis,
        fechaLectura: r.fecha_lectura,
        meter: normMeter,
        previousReading: prev,
        confirmation: r.evento_lectura ? { motivoEnergiaMenor: r.evento_lectura } : null,
      });

    const rDate = toDate(r.fecha_lectura);
    let bounds = getBillingPeriodBounds(rDate, cfg.dia_corte);

    // Si en los últimos días antes del corte ocurrió el reinicio de demanda cerca del corte,
    // adelanta la apertura al nuevo periodo de facturación
    if (
      (calc.abreNuevoPeriodoDemanda || r.evento_lectura === 'reinicio_demanda') &&
      rDate < bounds.end &&
      bounds.end.getTime() - rDate.getTime() <= cfg.ventana_corte_dias * 86400000
    ) {
      bounds = getBillingPeriodBounds(new Date(bounds.end.getTime() + 3600000), cfg.dia_corte);
      forcedShiftCounter++;
    } else if (forcedShiftCounter > 0 && prev) {
      // Si la lectura previa ya abrió el periodo entrante cerca del corte, mantener en el nuevo periodo
      const prevEntryKey = prev._assignedPeriodKey;
      if (prevEntryKey && prevEntryKey > bounds.key) {
        bounds = getBillingPeriodBounds(new Date(bounds.end.getTime() + 3600000), cfg.dia_corte);
      }
    }

    r._assignedPeriodKey = bounds.key;

    if (!periodsMap.has(bounds.key)) {
      periodsMap.set(bounds.key, {
        key: bounds.key,
        start: bounds.start,
        end: bounds.end,
        firstReadingAt: rDate,
        lastReadingAt: rDate,
        prevBeforePeriodAt: prev ? toDate(prev.fecha_lectura) : null,
        readingsCount: 0,
        horasMedidas: 0,
        kWhHP: 0,
        kWhHFP: 0,
        kWhTotal: 0,
        kVARhTotal: 0,
        demandaT1Max: null,
        demandaT2Max: null,
        demandaHPMax: null,
        demandaHFPMax: null,
        demandaMaximaMes: null,
      });
    }

    const bucket = periodsMap.get(bounds.key);
    bucket.readingsCount += 1;
    bucket.lastReadingAt = rDate;

    // Solo acumular consumo cuando existe tramo medido (idx > 0)
    if (prev && calc.horasTranscurridas && calc.horasTranscurridas > 0) {
      const prevDate = toDate(prev.fecha_lectura);
      // Si el tramo cruza la frontera de inicio del periodo y NO fue un reinicio explícito, prorratear por horas
      let ratioInPeriod = 1;
      if (prevDate < bucket.start && rDate > bucket.start && !calc.abreNuevoPeriodoDemanda) {
        const totalMs = rDate.getTime() - prevDate.getTime();
        const insideMs = rDate.getTime() - bucket.start.getTime();
        ratioInPeriod = Math.max(0, Math.min(1, insideMs / totalMs));
      }

      bucket.horasMedidas += calc.horasTranscurridas * ratioInPeriod;
      bucket.kWhTotal += (calc.consumoTotal || 0) * ratioInPeriod;
      if (calc.consumoHP !== null) bucket.kWhHP += calc.consumoHP * ratioInPeriod;
      if (calc.consumoHFP !== null) bucket.kWhHFP += calc.consumoHFP * ratioInPeriod;
      if (calc.consumoReactiva !== null) bucket.kVARhTotal += calc.consumoReactiva * ratioInPeriod;
    }

    if (calc.demandaT1 !== null) {
      bucket.demandaT1Max =
        bucket.demandaT1Max === null ? calc.demandaT1 : Math.max(bucket.demandaT1Max, calc.demandaT1);
    }
    if (calc.demandaT2 !== null) {
      bucket.demandaT2Max =
        bucket.demandaT2Max === null ? calc.demandaT2 : Math.max(bucket.demandaT2Max, calc.demandaT2);
    }
    if (calc.demandaHP !== null) {
      bucket.demandaHPMax =
        bucket.demandaHPMax === null ? calc.demandaHP : Math.max(bucket.demandaHPMax, calc.demandaHP);
    }
    if (calc.demandaHFP !== null) {
      bucket.demandaHFPMax =
        bucket.demandaHFPMax === null
          ? calc.demandaHFP
          : Math.max(bucket.demandaHFPMax, calc.demandaHFP);
    }
    if (calc.demandaMaxLectura !== null) {
      bucket.demandaMaximaMes =
        bucket.demandaMaximaMes === null
          ? calc.demandaMaxLectura
          : Math.max(bucket.demandaMaximaMes, calc.demandaMaxLectura);
    }
  });

  // Asegurar que exista al menos el periodo de referencia actual aunque esté vacío
  const refBounds = getBillingPeriodBounds(referenceDate, cfg.dia_corte);
  const allPeriodKeys = Array.from(periodsMap.keys()).sort();
  const latestPeriodKey =
    allPeriodKeys.length > 0 && allPeriodKeys[allPeriodKeys.length - 1] > refBounds.key
      ? allPeriodKeys[allPeriodKeys.length - 1]
      : refBounds.key;

  if (!periodsMap.has(latestPeriodKey)) {
    periodsMap.set(latestPeriodKey, {
      key: refBounds.key,
      start: refBounds.start,
      end: refBounds.end,
      firstReadingAt: null,
      lastReadingAt: null,
      prevBeforePeriodAt: null,
      readingsCount: 0,
      horasMedidas: 0,
      kWhHP: 0,
      kWhHFP: 0,
      kWhTotal: 0,
      kVARhTotal: 0,
      demandaT1Max: null,
      demandaT2Max: null,
      demandaHPMax: null,
      demandaHFPMax: null,
      demandaMaximaMes: null,
    });
  }

  // Finalizar métricas de cada periodo (calificación, reactiva excedente, proyección)
  const calendarOpts = {
    hpInicio: cfg.hp_inicio,
    hpFin: cfg.hp_fin,
    excluirDomingos: cfg.excluir_domingos_hp,
    excluirFeriados: cfg.excluir_feriados_hp,
    usarFeriadosPeru: cfg.usar_feriados_peru,
    feriadosExtra: cfg.feriados_extra,
  };

  const finalizedPeriods = Array.from(periodsMap.values())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((p) => {
      const pRound = isLuz ? round2 : round3;
      const kWhTotal = pRound(p.kWhTotal);
      const kWhHP = isTrifasico && cfg.hp_registro !== 'sin_asignar' ? round2(p.kWhHP) : null;
      const kWhHFP = isTrifasico && cfg.hp_registro !== 'sin_asignar' ? round2(p.kWhHFP) : null;
      const kVARhTotal = round2(p.kVARhTotal);

      const promedioDiarioPeriodo =
        p.horasMedidas > 0 ? pRound((kWhTotal / p.horasMedidas) * 24) : 0;

      const remainingHours =
        p.lastReadingAt && p.end > p.lastReadingAt
          ? (p.end.getTime() - p.lastReadingAt.getTime()) / 3600000
          : 0;

      const proyeccionCorte = pRound(kWhTotal + promedioDiarioPeriodo * (remainingHours / 24));

      // Horas HP del tramo efectivamente medido dentro del periodo y del ciclo completo
      const spanStart = p.prevBeforePeriodAt
        ? new Date(Math.max(p.start.getTime(), p.prevBeforePeriodAt.getTime()))
        : p.firstReadingAt || p.start;
      const spanEnd = p.lastReadingAt && p.lastReadingAt > spanStart ? p.lastReadingAt : p.end;
      const horasHPPeriodo = isLuz ? countPeakHoursInRange(spanStart, spanEnd, calendarOpts) : 0;
      const horasHPCicloCompleto = isLuz ? countPeakHoursInRange(p.start, p.end, calendarOpts) : 0;

      let calificacion = null;
      let calificacionTexto = null;
      if (
        isTrifasico &&
        kWhHP !== null &&
        horasHPPeriodo > 0 &&
        p.demandaMaximaMes !== null &&
        p.demandaMaximaMes > 0
      ) {
        calificacion = round4(kWhHP / horasHPPeriodo / p.demandaMaximaMes);
        calificacionTexto =
          calificacion >= Number(cfg.umbrales.calificacion_umbral || 0.5)
            ? 'presente en punta'
            : 'fuera de punta';
      }

      const reactivaPct = kWhTotal > 0 ? round2((kVARhTotal / kWhTotal) * 100) : 0;
      const reactivaLibre = round2((Number(cfg.umbrales.reactiva_roja_pct || 30) / 100) * kWhTotal);
      const reactivaExcedente = cfg.cobra_reactiva
        ? round2(Math.max(0, kVARhTotal - reactivaLibre))
        : 0;

      return {
        ...p,
        kWhTotal,
        kWhHP,
        kWhHFP,
        kVARhTotal,
        promedioDiarioPeriodo,
        proyeccionCorte,
        horasHPPeriodo,
        horasHPCicloCompleto,
        calificacion,
        calificacionTexto,
        reactivaPct,
        reactivaExcedente,
      };
    });

  const currentPeriod =
    finalizedPeriods.find((p) => p.key === latestPeriodKey) ||
    finalizedPeriods[finalizedPeriods.length - 1];

  const previousPeriods = finalizedPeriods.filter((p) => p.key < currentPeriod.key);
  const last5PreviousPeriods = previousPeriods.slice(-5);
  const last6PeriodsIncludingCurrent = [...last5PreviousPeriods, currentPeriod];

  // Potencia de distribución estimada: promedio de las 2 mayores demandas de los últimos 6 meses (incluido el actual)
  let potenciaDistribucionTotal = null;
  let potenciaDistribucionHP = null;

  if (isLuz && cfg.usa_potencia_variable) {
    const validTotalDemands = last6PeriodsIncludingCurrent
      .map((p) => p.demandaMaximaMes)
      .filter((d) => d !== null && d > 0)
      .sort((a, b) => b - a);

    if (validTotalDemands.length > 0) {
      const top2 = validTotalDemands.slice(0, 2);
      potenciaDistribucionTotal = round2(
        top2.reduce((acc, v) => acc + v, 0) / top2.length
      );
    }

    // Para la de HP, usar SOLO demandas HP
    const validHpDemands = last6PeriodsIncludingCurrent
      .map((p) => p.demandaHPMax)
      .filter((d) => d !== null && d > 0)
      .sort((a, b) => b - a);

    if (validHpDemands.length > 0) {
      const top2Hp = validHpDemands.slice(0, 2);
      potenciaDistribucionHP = round2(
        top2Hp.reduce((acc, v) => acc + v, 0) / top2Hp.length
      );
    }
  }

  // 2.ª mayor demanda de los 5 meses anteriores (para alertas de demanda HP y Total por separado)
  const prev5TotalsSorted = last5PreviousPeriods
    .map((p) => p.demandaMaximaMes)
    .filter((d) => d !== null && d > 0)
    .sort((a, b) => b - a);
  const segundaMayor5MesesTotal =
    prev5TotalsSorted.length >= 2 ? prev5TotalsSorted[1] : null;

  const prev5HpSorted = last5PreviousPeriods
    .map((p) => p.demandaHPMax)
    .filter((d) => d !== null && d > 0)
    .sort((a, b) => b - a);
  const segundaMayor5MesesHP = prev5HpSorted.length >= 2 ? prev5HpSorted[1] : null;

  const immediatePreviousPeriod =
    previousPeriods.length > 0 ? previousPeriods[previousPeriods.length - 1] : null;

  return {
    meter: normMeter,
    config: cfg,
    currentPeriod: {
      ...currentPeriod,
      potenciaDistribucionTotal,
      potenciaDistribucionHP,
      segundaMayor5MesesTotal,
      segundaMayor5MesesHP,
      calificacionMesAnterior: immediatePreviousPeriod?.calificacionTexto || null,
    },
    previousPeriods,
    allPeriods: finalizedPeriods,
  };
}

/**
 * 5. EVALUADOR COMPLETO DE ALERTAS TRAS UNA LECTURA
 * Cada alerta incluye: valor_detectado, umbral_referencia, causa y accion_sugerida.
 */
export function evaluateAlertsForReading({
  allMeterReadings = [],
  newReading,
  meter,
  sedeNombre = 'Sede',
}) {
  const normMeter = normalizeMeterObis(meter);
  const cfg = normalizeMeterConfig(normMeter);
  const u = cfg.umbrales;
  const unit = normMeter.unidad;
  const serviceLabel = normMeter.tipo === 'luz' ? 'Energía' : 'Agua';

  const normalizedNew = normalizeReadingObis(newReading);
  const allWithNew = [
    ...allMeterReadings.filter((r) => r.id !== normalizedNew.id),
    normalizedNew,
  ]
    .map(normalizeReadingObis)
    .sort((a, b) => new Date(a.fecha_lectura).getTime() - new Date(b.fecha_lectura).getTime());

  const newIdx = allWithNew.findIndex((r) => r.id === normalizedNew.id);
  const prevReading = newIdx > 0 ? allWithNew[newIdx - 1] : null;

  const step =
    normalizedNew.calculos ||
    calculateReadingStep({
      valorCrudo: normalizedNew.valor_crudo ?? normalizedNew.valor_lectura,
      obisValues: normalizedNew.lecturas_obis,
      fechaLectura: normalizedNew.fecha_lectura,
      meter: normMeter,
      previousReading: prevReading,
      confirmation: normalizedNew.evento_lectura
        ? { motivoEnergiaMenor: normalizedNew.evento_lectura }
        : null,
    });

  const summary = computePeriodAndTariffSummary({
    readings: allWithNew,
    meter: normMeter,
    referenceDate: toDate(normalizedNew.fecha_lectura),
  });
  const cp = summary.currentPeriod;
  const alerts = [];

  // 1) Consumo diario vs promedio del mismo día de semana en las últimas 4 semanas
  if (prevReading && step.promedioDiario > 0) {
    const newDate = toDate(normalizedNew.fecha_lectura);
    const targetDow = newDate.getDay();
    const fourWeeksAgoMs = newDate.getTime() - 35 * 86400000;

    const priorSameDowRates = [];
    for (let i = 1; i < newIdx; i++) {
      const r = allWithNew[i];
      const rPrev = allWithNew[i - 1];
      const rDate = toDate(r.fecha_lectura);
      if (rDate.getTime() >= fourWeeksAgoMs && rDate < newDate && rDate.getDay() === targetDow) {
        const c =
          r.calculos ||
          calculateReadingStep({
            valorCrudo: r.valor_crudo ?? r.valor_lectura,
            obisValues: r.lecturas_obis,
            fechaLectura: r.fecha_lectura,
            meter: normMeter,
            previousReading: rPrev,
          });
        if (c.promedioDiario > 0) {
          priorSameDowRates.push(c.promedioDiario);
        }
      }
    }

    const last4SameDow = priorSameDowRates.slice(-4);
    if (last4SameDow.length >= Number(u.min_muestras_mismo_dia || 3)) {
      const avg4w = round2(
        last4SameDow.reduce((acc, v) => acc + v, 0) / last4SameDow.length
      );
      if (avg4w > 0) {
        const pctOver = round2(((step.promedioDiario - avg4w) / avg4w) * 100);
        if (pctOver > Number(u.consumo_ambar_pct || 20)) {
          const isRoja = pctOver > Number(u.consumo_roja_pct || 40);
          const limitPct = isRoja ? u.consumo_roja_pct : u.consumo_ambar_pct;
          const umbralValor = round2(avg4w * (1 + Number(limitPct) / 100));

          alerts.push({
            codigo_regla: 'consumo_desvio_4sem',
            tipo_alerta: 'consumo_desvio_4sem',
            periodo_key: cp.key,
            severidad: isRoja ? 'roja' : 'ambar',
            valor_detectado: step.promedioDiario,
            umbral_referencia: umbralValor,
            titulo: `Desvío de ${serviceLabel} (+${pctOver}%) en ${sedeNombre}`,
            causa: `Promedio diario actual (${step.promedioDiario} ${unit}/día) supera en +${pctOver}% el promedio de los últimos ${last4SameDow.length} mismos días de semana (${avg4w} ${unit}/día).`,
            accion_sugerida:
              normMeter.tipo === 'agua'
                ? 'Inspeccionar posibles fugas internas, válvulas abiertas o cisternas rebalsando.'
                : 'Verificar equipos encendidos fuera de horario, climatización o cargas atípicas en la sede.',
          });
        }
      }
    }
  }

  // 2) Demanda vs la 2.ª mayor demanda de los 5 meses anteriores (HP y Total por separado)
  if (normMeter.tipo === 'luz') {
    if (cp.segundaMayor5MesesTotal !== null && cp.demandaMaximaMes !== null) {
      const ratioTotal = round2((cp.demandaMaximaMes / cp.segundaMayor5MesesTotal) * 100);
      if (ratioTotal >= Number(u.demanda_ambar_pct || 90)) {
        const supera = cp.demandaMaximaMes > cp.segundaMayor5MesesTotal;
        alerts.push({
          codigo_regla: 'demanda_vs_5m_total',
          tipo_alerta: 'demanda_vs_5m_total',
          periodo_key: cp.key,
          severidad: supera ? 'roja' : 'ambar',
          valor_detectado: cp.demandaMaximaMes,
          umbral_referencia: supera
            ? cp.segundaMayor5MesesTotal
            : round2(cp.segundaMayor5MesesTotal * (Number(u.demanda_ambar_pct || 90) / 100)),
          titulo: supera
            ? `Demanda Total supera base histórica en ${sedeNombre}`
            : `Demanda Total al ${ratioTotal}% del tope histórico en ${sedeNombre}`,
          causa: supera
            ? `La demanda máxima actual (${cp.demandaMaximaMes} kW) superó la 2.ª mayor demanda de los últimos 5 meses (${cp.segundaMayor5MesesTotal} kW), lo que elevará la potencia facturada.`
            : `La demanda máxima actual (${cp.demandaMaximaMes} kW) alcanzó el ${ratioTotal}% de la 2.ª mayor demanda de los 5 meses previos (${cp.segundaMayor5MesesTotal} kW).`,
          accion_sugerida:
            'Escalonar el arranque simultáneo de motores/equipos pesados para no elevar la potencia de distribución de los próximos 6 meses.',
        });
      }
    }

    if (cp.segundaMayor5MesesHP !== null && cp.demandaHPMax !== null) {
      const ratioHP = round2((cp.demandaHPMax / cp.segundaMayor5MesesHP) * 100);
      if (ratioHP >= Number(u.demanda_ambar_pct || 90)) {
        const superaHP = cp.demandaHPMax > cp.segundaMayor5MesesHP;
        alerts.push({
          codigo_regla: 'demanda_vs_5m_hp',
          tipo_alerta: 'demanda_vs_5m_hp',
          periodo_key: cp.key,
          severidad: superaHP ? 'roja' : 'ambar',
          valor_detectado: cp.demandaHPMax,
          umbral_referencia: superaHP
            ? cp.segundaMayor5MesesHP
            : round2(cp.segundaMayor5MesesHP * (Number(u.demanda_ambar_pct || 90) / 100)),
          titulo: superaHP
            ? `Demanda en Hora Punta supera base histórica en ${sedeNombre}`
            : `Demanda HP al ${ratioHP}% del tope histórico en ${sedeNombre}`,
          causa: superaHP
            ? `La demanda HP del mes (${cp.demandaHPMax} kW) superó la 2.ª mayor demanda HP de los 5 meses anteriores (${cp.segundaMayor5MesesHP} kW), aumentando la potencia facturada en punta.`
            : `La demanda HP del mes (${cp.demandaHPMax} kW) está en ${ratioHP}% respecto a la referencia de 5 meses (${cp.segundaMayor5MesesHP} kW).`,
          accion_sugerida: `Desplazar cargas intensivas fuera del horario punta (${cfg.hp_inicio}-${cfg.hp_fin}).`,
        });
      }
    }

    // 3) Calificación tarifaria (cambio vs mes anterior = roja; entre 0.45 y 0.55 = ámbar)
    if (cfg.aplica_calificacion && cp.calificacion !== null) {
      if (
        cp.calificacionMesAnterior &&
        cp.calificacionTexto &&
        cp.calificacionTexto !== cp.calificacionMesAnterior
      ) {
        alerts.push({
          codigo_regla: 'calificacion_tarifaria',
          tipo_alerta: 'calificacion_tarifaria',
          periodo_key: cp.key,
          severidad: 'roja',
          valor_detectado: cp.calificacion,
          umbral_referencia: Number(u.calificacion_umbral || 0.5),
          titulo: `Cambio de calificación a "${cp.calificacionTexto}" en ${sedeNombre}`,
          causa: `El factor de calificación actual (${cp.calificacion}) cambió de "${cp.calificacionMesAnterior}" a "${cp.calificacionTexto}" (umbral ${u.calificacion_umbral}).`,
          accion_sugerida:
            cp.calificacionTexto === 'presente en punta'
              ? 'Reducir consumo entre 18:00-23:00 antes del cierre de facturación para mantener tarifa fuera de punta.'
              : 'Revisar impacto tarifario del cambio de calificación en el recibo del periodo.',
        });
      } else if (
        cp.calificacion >= Number(u.calificacion_banda_min || 0.45) &&
        cp.calificacion <= Number(u.calificacion_banda_max || 0.55)
      ) {
        alerts.push({
          codigo_regla: 'calificacion_tarifaria',
          tipo_alerta: 'calificacion_tarifaria',
          periodo_key: cp.key,
          severidad: 'ambar',
          valor_detectado: cp.calificacion,
          umbral_referencia: Number(u.calificacion_umbral || 0.5),
          titulo: `Calificación en franja crítica (${cp.calificacion}) en ${sedeNombre}`,
          causa: `La calificación del periodo (${cp.calificacion}) se ubica en la banda sensible [${u.calificacion_banda_min} – ${u.calificacion_banda_max}] cercana al corte de 0.50.`,
          accion_sugerida: `Controlar cargas en horario punta (${cfg.hp_inicio}-${cfg.hp_fin}) para evitar saltar a "presente en punta".`,
        });
      }
    }

    // 4) Energía Reactiva / Activa (ámbar >= 27 %, roja > 30 %)
    if ((cfg.cobra_reactiva || cfg.usa_reactiva_obis) && cp.kWhTotal > 0 && cp.kVARhTotal > 0) {
      if (cp.reactivaPct >= Number(u.reactiva_ambar_pct || 27)) {
        const isRoja = cp.reactivaPct > Number(u.reactiva_roja_pct || 30);
        alerts.push({
          codigo_regla: 'reactiva_porcentaje',
          tipo_alerta: 'reactiva_porcentaje',
          periodo_key: cp.key,
          severidad: isRoja ? 'roja' : 'ambar',
          valor_detectado: cp.reactivaPct,
          umbral_referencia: Number(isRoja ? u.reactiva_roja_pct : u.reactiva_ambar_pct),
          titulo: isRoja
            ? `Penalización por Energía Reactiva (${cp.reactivaPct}%) en ${sedeNombre}`
            : `Energía Reactiva cercana al límite (${cp.reactivaPct}%) en ${sedeNombre}`,
          causa: isRoja
            ? `La relación reactiva/activa alcanzó ${cp.reactivaPct}% (> ${u.reactiva_roja_pct}%), acumulando ${cp.reactivaExcedente} kVARh facturables.`
            : `La relación reactiva/activa llegó a ${cp.reactivaPct}% (alerta preventiva en ${u.reactiva_ambar_pct}%).`,
          accion_sugerida:
            'Revisar contactores, fusibles y pasos automáticos del banco de condensadores.',
        });
      }
    }
  }

  // 5) Consumo cero en día laborable
  if (
    prevReading &&
    !normalizedNew.evento_lectura &&
    step.consumoTotal === 0 &&
    isWorkday(normalizedNew.fecha_lectura, {
      diasLaborables: cfg.dias_laborables,
      usarFeriadosPeru: cfg.usar_feriados_peru,
      feriadosExtra: cfg.feriados_extra,
    })
  ) {
    alerts.push({
      codigo_regla: 'consumo_cero_laborable',
      tipo_alerta: 'consumo_cero_laborable',
      periodo_key: cp.key,
      severidad: 'aviso',
      valor_detectado: 0,
      umbral_referencia: 0.01,
      titulo: `Consumo cero en día laborable (${serviceLabel}) — ${sedeNombre}`,
      causa: `La lectura registrada en día laborable no presentó variación de consumo (0 ${unit}).`,
      accion_sugerida:
        'Confirmar si la sede estuvo sin actividad o inspeccionar posible medidor trabado/averiado.',
    });
  }

  return alerts.map((a) => ({
    ...a,
    mensaje: `Valor: ${a.valor_detectado} (Umbral: ${a.umbral_referencia}). Causa: ${a.causa} Acción: ${a.accion_sugerida}`,
  }));
}

const SEVERITY_RANK = {
  aviso: 1,
  media: 2,
  ambar: 2,
  alta: 3,
  roja: 3,
};

/**
 * Determina si una alerta nueva en el mismo periodo debe insertarse, escalarse/actualizarse
 * porque empeoró, o ignorarse para no duplicarla en el mismo periodo.
 */
export function decideAlertPersistence(candidateAlert, existingPeriodAlerts = []) {
  const match = existingPeriodAlerts.find(
    (ex) =>
      !ex.resuelta &&
      (ex.codigo_regla === candidateAlert.codigo_regla ||
        ex.tipo_alerta === candidateAlert.tipo_alerta) &&
      ex.periodo_key === candidateAlert.periodo_key
  );

  if (!match) {
    return { action: 'insert', existingId: null };
  }

  const newRank = SEVERITY_RANK[candidateAlert.severidad] || 1;
  const oldRank = SEVERITY_RANK[match.severidad] || 1;

  if (newRank > oldRank) {
    return { action: 'update', existingId: match.id };
  }

  if (
    newRank === oldRank &&
    candidateAlert.valor_detectado !== null &&
    match.valor_detectado !== null
  ) {
    const diff = Number(candidateAlert.valor_detectado) - Number(match.valor_detectado);
    // Para avisos de horas sin lectura, escalar solo si transcurrieron al menos 24h adicionales
    if (candidateAlert.codigo_regla === 'sin_lectura_24h') {
      if (diff >= 24) return { action: 'update', existingId: match.id };
      return { action: 'skip', existingId: match.id };
    }
    if (diff > 0.01) {
      return { action: 'update', existingId: match.id };
    }
  }

  return { action: 'skip', existingId: match.id };
}

/**
 * Evalúa sedes / medidores activos sin lectura en las últimas 24 h (o umbral configurado).
 */
export function evaluateMissingReadingsAlerts({
  sedes = [],
  meters = [],
  readings = [],
  now = new Date(),
}) {
  const nowDate = toDate(now);
  const missingAlerts = [];

  meters
    .filter((m) => m.activo !== false)
    .forEach((rawMeter) => {
      const meter = normalizeMeterObis(rawMeter);
      const sede = sedes.find((s) => s.id === meter.sede_id);
      if (!sede || sede.activa === false) return;

      const cfg = normalizeMeterConfig(meter);
      const maxHours = Number(cfg.umbrales.horas_sin_lectura_aviso || 24);
      const meterReadings = readings
        .filter((r) => r.meter_id === meter.id)
        .sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime());

      const latest = meterReadings[0] || null;
      if (!latest) return; // Evitar alertar medidores recién creados sin línea base inicial

      const hoursElapsed = round2(
        (nowDate.getTime() - toDate(latest.fecha_lectura).getTime()) / 3600000
      );

      if (hoursElapsed > maxHours) {
        const period = getBillingPeriodBounds(nowDate, cfg.dia_corte);
        const causa = `Han transcurrido ${hoursElapsed} horas sin recibir lectura del medidor "${meter.nombre}" en ${sede.nombre}.`;
        const accion = 'Solicitar al operario de turno registrar la lectura actual con foto.';
        missingAlerts.push({
          sede_id: sede.id,
          meter_id: meter.id,
          reading_id: latest.id,
          codigo_regla: 'sin_lectura_24h',
          tipo_alerta: 'sin_lectura_24h',
          periodo_key: period.key,
          severidad: 'aviso',
          valor_detectado: hoursElapsed,
          umbral_referencia: maxHours,
          titulo: `Sin lectura en >${maxHours} h (${meter.nombre}) — ${sede.nombre}`,
          causa,
          accion_sugerida: accion,
          mensaje: `Valor: ${hoursElapsed} h (Umbral: ${maxHours} h). Causa: ${causa} Acción: ${accion}`,
        });
      }
    });

  return missingAlerts;
}
