import {
  calculateReadingStep,
  computePeriodAndTariffSummary,
  decideAlertPersistence,
  evaluateAlertsForReading,
  evaluateMissingReadingsAlerts,
  getBillingPeriodBounds,
  isNearBillingCut,
  validateReadingBeforeSave,
} from './billingEngine';

export {
  calculateReadingStep,
  computePeriodAndTariffSummary,
  decideAlertPersistence,
  evaluateAlertsForReading,
  evaluateMissingReadingsAlerts,
  getBillingPeriodBounds,
  isNearBillingCut,
  validateReadingBeforeSave,
};

/**
 * Adaptador de vista rápida en vivo para el formulario de Registro.
 */
export function evaluateReadingConsumption({
  valorLectura,
  obisValues = null,
  fechaLectura = new Date().toISOString(),
  meter,
  previousReadings = [],
  hasMedia = false,
  confirmation = {},
}) {
  const validation = validateReadingBeforeSave({
    valorCrudo: valorLectura,
    obisValues,
    fechaLectura,
    meter,
    previousReadings,
    hasMedia,
    confirmation,
  });

  const step = validation.step;
  if (!step) {
    return {
      valid: false,
      blockingIssues: validation.blockingIssues,
      notices: validation.notices,
      step: null,
      consumoTotalPeriodo: 0,
      consumoDiario: 0,
      esAnomalo: validation.blockingIssues.length > 0,
      motivoAnomalia: validation.blockingIssues[0]?.message || null,
    };
  }

  // Simular alertas preventivas con la lectura en curso
  const tempReading = {
    id: '__preview__',
    meter_id: meter?.id,
    sede_id: meter?.sede_id,
    tipo: meter?.tipo,
    valor_crudo: step.valorCrudoPrimario,
    valor_lectura: step.valorCrudoPrimario,
    lecturas_obis: obisValues,
    calculos: step,
    evento_lectura: confirmation?.motivoEnergiaMenor || null,
    fecha_lectura: fechaLectura,
  };

  const triggeredAlerts = evaluateAlertsForReading({
    allMeterReadings: previousReadings,
    newReading: tempReading,
    meter,
    sedeNombre: 'Sede',
  });

  const highestAlert = triggeredAlerts[0] || null;

  return {
    valid: validation.valid,
    blockingIssues: validation.blockingIssues,
    notices: validation.notices,
    step,
    triggeredAlerts,
    lecturaAnterior: step.prevValorCrudoPrimario,
    horasTranscurridas: step.horasTranscurridas,
    diasTranscurridos: step.diasEquivalentes || 1,
    consumoHP: step.consumoHP,
    consumoHFP: step.consumoHFP,
    consumoTotalPeriodo: step.consumoTotal,
    consumoDiario: step.promedioDiario,
    consumoReactiva: step.consumoReactiva,
    demandaHP: step.demandaHP,
    demandaHFP: step.demandaHFP,
    demandaMaxLectura: step.demandaMaxLectura,
    esAnomalo: validation.blockingIssues.length > 0 || triggeredAlerts.length > 0,
    severidad: highestAlert?.severidad || (validation.blockingIssues.length > 0 ? 'roja' : 'aviso'),
    motivoAnomalia:
      validation.blockingIssues[0]?.message || highestAlert?.mensaje || null,
  };
}

export function sanitizeDni(dni = '') {
  return String(dni).replace(/[^0-9A-Za-z]/g, '').trim();
}
