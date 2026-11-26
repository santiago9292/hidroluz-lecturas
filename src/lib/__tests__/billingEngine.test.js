import { describe, expect, it } from 'vitest';
import {
  calculateReadingStep,
  computePeriodAndTariffSummary,
  decideAlertPersistence,
  evaluateAlertsForReading,
  validateReadingBeforeSave,
} from '../billingEngine';
import {
  buildDefaultTariffConfig,
  formatAguaNumber,
  formatLuzNumber,
  normalizeMeterObis,
  sanitizeDecimalInput,
} from '../obis';

function createTestTrifasicoMeter(overrides = {}) {
  const baseCfg = {
    ...buildDefaultTariffConfig('luz', true),
    tarifa: 'MT3',
    factor_energia: 1,
    factor_demanda: 1,
    dia_corte: 1,
    ventana_corte_dias: 3,
    hp_registro: 'T2', // T1 (1.8.1/1.6.1) = HFP, T2 (1.8.2/1.6.2) = HP
    modo_1621: 'historico',
    usa_reactiva_obis: true,
    codigo_reactiva: '3.8.0',
    usa_potencia_variable: true,
    aplica_calificacion: true,
    cobra_reactiva: true,
    ...(overrides.config_tarifaria || {}),
  };

  return {
    id: 'meter-mt3',
    sede_id: 'sede-lab',
    tipo: 'luz',
    nombre: 'Medidor Trifásico Laboratorio',
    unidad: 'kWh',
    es_trifasico: true,
    ...overrides,
    config_tarifaria: baseCfg,
  };
}

describe('Motor de Cálculo Tarifario, Validaciones y Alertas (billingEngine)', () => {
  it('1. Día normal: calcula HP, HFP, Total (sin sumar acumulados), promedio 24h, calificación y reactiva', () => {
    const meter = createTestTrifasicoMeter();
    const prevReading = {
      id: 'r1',
      meter_id: meter.id,
      fecha_lectura: '2026-11-10T08:00:00.000Z',
      lecturas_obis: {
        '1.8.1': 2835,
        '1.8.2': 213,
        '1.6.1': 18,
        '1.6.2': 12,
        '3.8.0': 500,
      },
    };

    // 24 horas exactas después
    const step = calculateReadingStep({
      obisValues: {
        '1.8.1': 2915, // +80 kWh HFP
        '1.8.2': 243, // +30 kWh HP
        '1.6.1': 20, // 20 kW HFP
        '1.6.2': 12, // 12 kW HP
        '3.8.0': 540, // +40 kVARh (> 30% de 110 kWh = 33 kVARh -> 7 kVARh excedente)
      },
      fechaLectura: '2026-11-11T08:00:00.000Z',
      meter,
      previousReading: prevReading,
    });

    expect(step.consumoHFP).toBe(80);
    expect(step.consumoHP).toBe(30);
    // Consumo total = HP + HFP = 110 (jamás 2915 + 243 = 3158)
    expect(step.consumoTotal).toBe(110);
    expect(step.promedioDiario).toBe(110);
    expect(step.demandaHFP).toBe(20);
    expect(step.demandaHP).toBe(12);
    expect(step.demandaMaxLectura).toBe(20);
    expect(step.consumoReactiva).toBe(40);
    expect(step.reactivaExcedenteTramo).toBe(7);

    // Verificar resumen del periodo y calificación:
    // Entre 10 Nov 08:00 y 11 Nov 08:00 (martes laborable) hay 5 horas HP (18:00-23:00).
    // Calificación = (30 kWh HP / 5 h HP) / 20 kW = 6 / 20 = 0.30 -> "fuera de punta"
    const summary = computePeriodAndTariffSummary({
      readings: [
        prevReading,
        {
          id: 'r2',
          meter_id: meter.id,
          fecha_lectura: '2026-11-11T08:00:00.000Z',
          lecturas_obis: {
            '1.8.1': 2915,
            '1.8.2': 243,
            '1.6.1': 20,
            '1.6.2': 12,
            '3.8.0': 540,
          },
          calculos: step,
        },
      ],
      meter,
      referenceDate: new Date('2026-11-11T12:00:00.000Z'),
    });

    expect(summary.currentPeriod.kWhHP).toBe(30);
    expect(summary.currentPeriod.kWhHFP).toBe(80);
    expect(summary.currentPeriod.kWhTotal).toBe(110);
    expect(summary.currentPeriod.demandaMaximaMes).toBe(20);
    expect(summary.currentPeriod.horasHPPeriodo).toBe(5);
    expect(summary.currentPeriod.calificacion).toBe(0.3);
    expect(summary.currentPeriod.calificacionTexto).toBe('fuera de punta');
    expect(summary.currentPeriod.reactivaExcedente).toBe(7);
  });

  it('2. Días sin lectura y horas distintas: calcula promedio exacto (consumo / horas * 24) y desvío 4 semanas en Agua', () => {
    const waterMeter = {
      id: 'm-agua',
      sede_id: 'sede-lab',
      tipo: 'agua',
      nombre: 'Medidor Agua',
      unidad: 'm3',
      es_trifasico: false,
      config_tarifaria: buildDefaultTariffConfig('agua', false),
    };

    // Pasaron 72 horas (3 días sin lectura intermedia) + 6 horas extra = 78 horas totales
    // Consumo = 65 m3 -> Promedio diario exacto = (65 / 78) * 24 = 20 m3/día
    const step = calculateReadingStep({
      valorCrudo: 565,
      fechaLectura: '2026-11-13T14:00:00.000Z',
      meter: waterMeter,
      previousReading: {
        id: 'w0',
        meter_id: waterMeter.id,
        valor_crudo: 500,
        valor_lectura: 500,
        fecha_lectura: '2026-11-10T08:00:00.000Z',
      },
    });

    expect(step.horasTranscurridas).toBe(78);
    expect(step.consumoTotal).toBe(65);
    expect(step.promedioDiario).toBe(20);

    // Historial de 4 jueves previos con 15 m3/día -> un jueves con 22.5 m3/día (+50%) dispara alerta ROJA (>40%)
    const history = [
      { id: 'h0', meter_id: 'm-agua', valor_crudo: 100, fecha_lectura: '2026-10-28T08:00:00Z' },
      { id: 'h1', meter_id: 'm-agua', valor_crudo: 115, fecha_lectura: '2026-10-29T08:00:00Z', calculos: { promedioDiario: 15, consumoTotal: 15, horasTranscurridas: 24 } },
      { id: 'h2', meter_id: 'm-agua', valor_crudo: 200, fecha_lectura: '2026-11-04T08:00:00Z' },
      { id: 'h3', meter_id: 'm-agua', valor_crudo: 215, fecha_lectura: '2026-11-05T08:00:00Z', calculos: { promedioDiario: 15, consumoTotal: 15, horasTranscurridas: 24 } },
      { id: 'h4', meter_id: 'm-agua', valor_crudo: 300, fecha_lectura: '2026-11-11T08:00:00Z' },
      { id: 'h5', meter_id: 'm-agua', valor_crudo: 315, fecha_lectura: '2026-11-12T08:00:00Z', calculos: { promedioDiario: 15, consumoTotal: 15, horasTranscurridas: 24 } },
      { id: 'h6', meter_id: 'm-agua', valor_crudo: 400, fecha_lectura: '2026-11-18T08:00:00Z' },
      { id: 'h7', meter_id: 'm-agua', valor_crudo: 415, fecha_lectura: '2026-11-19T08:00:00Z', calculos: { promedioDiario: 15, consumoTotal: 15, horasTranscurridas: 24 } },
      { id: 'h8', meter_id: 'm-agua', valor_crudo: 500, fecha_lectura: '2026-11-25T08:00:00Z' },
    ];

    const newThu = {
      id: 'h9',
      meter_id: 'm-agua',
      valor_crudo: 522.5,
      fecha_lectura: '2026-11-26T08:00:00Z',
    };

    const alerts = evaluateAlertsForReading({
      allMeterReadings: history,
      newReading: newThu,
      meter: waterMeter,
      sedeNombre: 'Laboratorio',
    });

    const desvio = alerts.find((a) => a.codigo_regla === 'consumo_desvio_4sem');
    expect(desvio).toBeDefined();
    expect(desvio.severidad).toBe('roja');
    expect(desvio.valor_detectado).toBe(22.5);
  });

  it('3. Reinicio de demanda y significado de 1.6.2.1: cerca del corte abre nuevo periodo; a mitad de periodo pide revisión', () => {
    const meter = createTestTrifasicoMeter({
      config_tarifaria: { dia_corte: 15, ventana_corte_dias: 3, modo_1621: 'historico' },
    });

    const prev = {
      id: 'p1',
      meter_id: meter.id,
      fecha_lectura: '2026-11-14T12:00:00.000Z',
      lecturas_obis: { '1.8.1': 1000, '1.8.2': 200, '1.6.1': 45, '1.6.2': 38 },
    };

    // Si 1.6.2.1 es histórico y solo pasan 1.6.2.1 sin 1.6.2 -> bloquea exigiendo 1.6.2
    const missing162 = validateReadingBeforeSave({
      obisValues: { '1.8.1': 1050, '1.8.2': 210, '1.6.1': 15, '1.6.2.1': 38 },
      fechaLectura: '2026-11-15T12:00:00.000Z',
      meter,
      previousReadings: [prev],
    });
    expect(missing162.valid).toBe(false);
    expect(missing162.blockingIssues[0].title).toContain('1.6.2');

    // Baja de demanda el día 15 (día de corte): reinicio normal, NO bloquea y abre nuevo periodo
    const nearCut = validateReadingBeforeSave({
      obisValues: { '1.8.1': 1050, '1.8.2': 210, '1.6.1': 12, '1.6.2': 9 },
      fechaLectura: '2026-11-15T12:00:00.000Z',
      meter,
      previousReadings: [prev],
    });
    expect(nearCut.valid).toBe(true);
    expect(nearCut.step.abreNuevoPeriodoDemanda).toBe(true);
    expect(nearCut.notices.some((n) => n.type === 'reinicio_demanda_corte')).toBe(true);

    // Baja de demanda el día 25 (mitad de periodo, lejos del día 15): bloquea y pide revisión
    const prevMid = {
      id: 'p2',
      meter_id: meter.id,
      fecha_lectura: '2026-11-24T12:00:00.000Z',
      lecturas_obis: { '1.8.1': 1500, '1.8.2': 300, '1.6.1': 40, '1.6.2': 30 },
    };
    const midDrop = validateReadingBeforeSave({
      obisValues: { '1.8.1': 1550, '1.8.2': 310, '1.6.1': 18, '1.6.2': 30 },
      fechaLectura: '2026-11-25T12:00:00.000Z',
      meter,
      previousReadings: [prevMid],
    });
    expect(midDrop.valid).toBe(false);
    expect(midDrop.blockingIssues[0].type).toBe('demanda_baja_mitad_periodo');
  });

  it('4. Error de digitación y salto >3x: bloquea energía menor y exige foto + confirmación en salto extremo', () => {
    const meter = createTestTrifasicoMeter();
    const history = [
      {
        id: 'd1',
        meter_id: meter.id,
        fecha_lectura: '2026-11-08T08:00:00.000Z',
        lecturas_obis: { '1.8.1': 2800, '1.8.2': 200, '1.6.1': 15, '1.6.2': 10 },
        calculos: { promedioDiario: 50 },
      },
      {
        id: 'd2',
        meter_id: meter.id,
        fecha_lectura: '2026-11-09T08:00:00.000Z',
        lecturas_obis: { '1.8.1': 2840, '1.8.2': 210, '1.6.1': 15, '1.6.2': 10 },
        calculos: { promedioDiario: 50 },
      },
    ];

    // Error de digitación: 1.8.1 ingresaron 2830 (< 2840)
    const typoCheck = validateReadingBeforeSave({
      obisValues: { '1.8.1': 2830, '1.8.2': 215, '1.6.1': 15, '1.6.2': 10 },
      fechaLectura: '2026-11-10T08:00:00.000Z',
      meter,
      previousReadings: history,
    });
    expect(typoCheck.valid).toBe(false);
    expect(typoCheck.blockingIssues[0].type).toBe('energia_menor');

    // Si confirma cambio_medidor, permite guardar y el consumo del corte es 0 (nueva base)
    const meterSwap = validateReadingBeforeSave({
      obisValues: { '1.8.1': 0, '1.8.2': 0, '1.6.1': 5, '1.6.2': 4 },
      fechaLectura: '2026-11-10T08:00:00.000Z',
      meter,
      previousReadings: history,
      confirmation: { motivoEnergiaMenor: 'cambio_medidor' },
    });
    expect(meterSwap.valid).toBe(true);
    expect(meterSwap.step.consumoTotal).toBe(0);

    // Salto > 3x el promedio (promedio = 50 -> ingreso de +220 kWh en 24h) sin foto -> bloquea
    const jumpBlocked = validateReadingBeforeSave({
      obisValues: { '1.8.1': 3040, '1.8.2': 230, '1.6.1': 16, '1.6.2': 11 },
      fechaLectura: '2026-11-10T08:00:00.000Z',
      meter,
      previousReadings: history,
      hasMedia: false,
      confirmation: { confirmarSalto: true }, // Falta foto
    });
    expect(jumpBlocked.valid).toBe(false);
    expect(jumpBlocked.blockingIssues[0].type).toBe('salto_extremo_confirmacion');

    // Con confirmación de dígitos Y foto adjunta -> desbloquea
    const jumpConfirmed = validateReadingBeforeSave({
      obisValues: { '1.8.1': 3040, '1.8.2': 230, '1.6.1': 16, '1.6.2': 11 },
      fechaLectura: '2026-11-10T08:00:00.000Z',
      meter,
      previousReadings: history,
      hasMedia: true,
      confirmation: { confirmarSalto: true },
    });
    expect(jumpConfirmed.valid).toBe(true);
  });

  it('5. Factor distinto de 1 (x40), potencia estimada 6 meses, alerta de demanda vs 5 meses y no-duplicación', () => {
    const meter = createTestTrifasicoMeter({
      config_tarifaria: {
        tarifa: 'MT3',
        factor_energia: 40,
        factor_demanda: 40,
        dia_corte: 1,
        hp_registro: 'T2',
        usa_potencia_variable: true,
      },
    });

    // 5 meses previos con lecturas crudas de demanda que multiplicadas x40 dan:
    // Jun: Total 100kW / HP 60kW | Jul: Total 120kW / HP 80kW | Ago: Total 90kW / HP 50kW
    // Sep: Total 110kW / HP 70kW | Oct: Total 105kW / HP 65kW
    // -> Las 2 mayores de los 5 meses previos son:
    //    Total: 1º=120, 2ª=110 | HP: 1º=80, 2ª=70
    const priorReadings = [
      { id: 'm6', meter_id: meter.id, fecha_lectura: '2026-06-20T10:00:00Z', lecturas_obis: { '1.8.1': 100, '1.8.2': 50, '1.6.1': 2.5, '1.6.2': 1.5 } },
      { id: 'm7', meter_id: meter.id, fecha_lectura: '2026-07-20T10:00:00Z', lecturas_obis: { '1.8.1': 150, '1.8.2': 70, '1.6.1': 3.0, '1.6.2': 2.0 } },
      { id: 'm8', meter_id: meter.id, fecha_lectura: '2026-08-20T10:00:00Z', lecturas_obis: { '1.8.1': 200, '1.8.2': 90, '1.6.1': 2.25, '1.6.2': 1.25 } },
      { id: 'm9', meter_id: meter.id, fecha_lectura: '2026-09-20T10:00:00Z', lecturas_obis: { '1.8.1': 260, '1.8.2': 110, '1.6.1': 2.75, '1.6.2': 1.75 } },
      { id: 'm10', meter_id: meter.id, fecha_lectura: '2026-10-20T10:00:00Z', lecturas_obis: { '1.8.1': 320, '1.8.2': 130, '1.6.1': 2.625, '1.6.2': 1.625 } },
      { id: 'm11a', meter_id: meter.id, fecha_lectura: '2026-11-10T10:00:00Z', lecturas_obis: { '1.8.1': 350, '1.8.2': 140, '1.6.1': 2.5, '1.6.2': 1.5 } },
    ];

    // Nueva lectura en Nov (24h después):
    // Delta 1.8.1 = 3.5 * 40 = 140 kWh HFP; Delta 1.8.2 = 1.5 * 40 = 60 kWh HP -> Total = 200 kWh
    // Demanda T1 cruda = 2.85 (*40 = 114 kW > 110 kW 2ª mayor!) -> ROJA en Total
    // Demanda T2 (HP) cruda = 1.65 (*40 = 66 kW -> 66/70 = 94.29% >= 90%) -> ÁMBAR en HP
    const novReading = {
      id: 'm11b',
      meter_id: meter.id,
      fecha_lectura: '2026-11-11T10:00:00Z',
      lecturas_obis: { '1.8.1': 353.5, '1.8.2': 141.5, '1.6.1': 2.85, '1.6.2': 1.65 },
    };

    const step = calculateReadingStep({
      obisValues: novReading.lecturas_obis,
      fechaLectura: novReading.fecha_lectura,
      meter,
      previousReading: priorReadings[priorReadings.length - 1],
    });

    expect(step.consumoHFP).toBe(140);
    expect(step.consumoHP).toBe(60);
    expect(step.consumoTotal).toBe(200);
    expect(step.demandaHFP).toBe(114);
    expect(step.demandaHP).toBe(66);

    const summary = computePeriodAndTariffSummary({
      readings: [...priorReadings, { ...novReading, calculos: step }],
      meter,
      referenceDate: new Date('2026-11-11T12:00:00Z'),
    });

    // Potencia distribución Total de 6 meses: promedio de las 2 mayores de [100, 120, 90, 110, 105, 114]
    // Top 2 = 120 y 114 -> promedio = 117 kW
    expect(summary.currentPeriod.potenciaDistribucionTotal).toBe(117);
    // Potencia distribución HP de 6 meses: promedio de las 2 mayores de [60, 80, 50, 70, 65, 66]
    // Top 2 = 80 y 70 -> promedio = 75 kW (solo demandas HP)
    expect(summary.currentPeriod.potenciaDistribucionHP).toBe(75);

    const alerts = evaluateAlertsForReading({
      allMeterReadings: priorReadings,
      newReading: { ...novReading, calculos: step },
      meter,
      sedeNombre: 'Planta MT3',
    });

    const alertTotal = alerts.find((a) => a.codigo_regla === 'demanda_vs_5m_total');
    const alertHP = alerts.find((a) => a.codigo_regla === 'demanda_vs_5m_hp');
    expect(alertTotal?.severidad).toBe('roja');
    expect(alertHP?.severidad).toBe('ambar');

    // Verificar no-duplicación en el mismo periodo salvo que empeore
    const existing = [{ ...alertHP, id: 'al-1', resuelta: false }];
    // Misma severidad e igual valor -> skip
    expect(decideAlertPersistence(alertHP, existing).action).toBe('skip');
    // Empeora a roja (75 kW > 70 kW) -> update
    expect(
      decideAlertPersistence({ ...alertHP, severidad: 'roja', valor_detectado: 75 }, existing)
        .action
    ).toBe('update');
  });

  it('6. Formato fijo: Luz siempre con 4 campos (2 decimales con cero) y Agua a 3 decimales exactos', () => {
    // Luz siempre normaliza a es_trifasico = true con sus 4 campos OBIS aunque venga sin flag de BD
    const legacyLuz = normalizeMeterObis({
      id: 'm-legacy',
      sede_id: 's1',
      tipo: 'luz',
      nombre: 'Medidor Principal Luz',
      unidad: 'kWh',
    });
    expect(legacyLuz.es_trifasico).toBe(true);
    expect(legacyLuz.codigos_obis).toHaveLength(4);

    // Autocompletado de ceros en Luz (hasta 2 decimales)
    expect(sanitizeDecimalInput('183,459', 2)).toBe('183.45');
    expect(formatLuzNumber('183.4')).toBe('183.40');
    expect(formatLuzNumber('23.9')).toBe('23.90');
    expect(formatLuzNumber('31')).toBe('31.00');

    // Precisión de 3 decimales en Agua (ej. 47.521 m3)
    expect(sanitizeDecimalInput('47.5219', 3)).toBe('47.521');
    expect(formatAguaNumber('47.521')).toBe('47.521');
    expect(formatAguaNumber('47.5')).toBe('47.500');

    const waterStep = calculateReadingStep({
      valorCrudo: 47.521,
      fechaLectura: '2026-11-26T08:00:00Z',
      meter: { id: 'w1', tipo: 'agua', unidad: 'm3', es_trifasico: false },
      previousReading: {
        id: 'w0',
        valor_crudo: 47.0,
        fecha_lectura: '2026-11-25T08:00:00Z',
      },
    });
    expect(waterStep.valorCrudoPrimario).toBe(47.521);
    expect(waterStep.consumoTotal).toBe(0.521);
  });
});
