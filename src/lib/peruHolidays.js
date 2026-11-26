/**
 * Feriados nacionales de Perú y utilidades de calendario para Hora Punta (HP)
 * y días laborables por sede/medidor.
 */

// Feriados nacionales fijos en Perú (MM-DD)
export const PERU_FIXED_HOLIDAYS_MMDD = [
  '01-01', // Año Nuevo
  '05-01', // Día del Trabajo
  '06-07', // Batalla de Arica y Día de la Bandera
  '06-29', // San Pedro y San Pablo
  '07-23', // Día de la Fuerza Aérea del Perú
  '07-28', // Fiestas Patrias
  '07-29', // Fiestas Patrias
  '08-06', // Batalla de Junín
  '08-30', // Santa Rosa de Lima
  '10-08', // Combate de Angamos
  '11-01', // Día de Todos los Santos
  '12-08', // Inmaculada Concepción
  '12-09', // Batalla de Ayacucho
  '12-25', // Navidad
];

// Jueves y Viernes Santo (móviles) precargados 2024-2030
export const PERU_MOVABLE_HOLIDAYS_YYYYMMDD = [
  '2024-03-28',
  '2024-03-29',
  '2025-04-17',
  '2025-04-18',
  '2026-04-02',
  '2026-04-03',
  '2027-03-25',
  '2027-03-26',
  '2028-04-13',
  '2028-04-14',
  '2029-03-29',
  '2029-03-30',
  '2030-04-18',
  '2030-04-19',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toLocalDateKey(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isHolidayDate(dateInput, { usarFeriadosPeru = true, feriadosExtra = [] } = {}) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const ymd = toLocalDateKey(d);
  const mmdd = ymd.slice(5);

  if (Array.isArray(feriadosExtra) && feriadosExtra.includes(ymd)) {
    return true;
  }
  if (usarFeriadosPeru) {
    if (PERU_FIXED_HOLIDAYS_MMDD.includes(mmdd)) return true;
    if (PERU_MOVABLE_HOLIDAYS_YYYYMMDD.includes(ymd)) return true;
  }
  return false;
}

export function isWorkday(
  dateInput,
  {
    diasLaborables = [1, 2, 3, 4, 5, 6], // Lun-Sáb por defecto (0 = Dom)
    usarFeriadosPeru = true,
    feriadosExtra = [],
  } = {}
) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const dow = d.getDay();
  if (!diasLaborables.includes(dow)) return false;
  if (isHolidayDate(d, { usarFeriadosPeru, feriadosExtra })) return false;
  return true;
}

function parseHmToHours(hm = '18:00') {
  const [h, m] = String(hm)
    .split(':')
    .map((x) => Number(x || 0));
  return h + m / 60;
}

/**
 * Calcula las horas de Hora Punta (por defecto 18:00-23:00 = 5h/día)
 * contenidas dentro del intervalo exacto [startDate, endDate].
 * Excluye domingos y/o feriados si la configuración del medidor lo indica.
 */
export function countPeakHoursInRange(
  startInput,
  endInput,
  {
    hpInicio = '18:00',
    hpFin = '23:00',
    excluirDomingos = true,
    excluirFeriados = true,
    usarFeriadosPeru = true,
    feriadosExtra = [],
  } = {}
) {
  const start = startInput instanceof Date ? startInput : new Date(startInput);
  const end = endInput instanceof Date ? endInput : new Date(endInput);
  if (end <= start) return 0;

  const hpStartHour = parseHmToHours(hpInicio);
  const hpEndHour = parseHmToHours(hpFin);
  if (hpEndHour <= hpStartHour) return 0;

  let totalHours = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);

  while (cursor <= lastDay) {
    const dow = cursor.getDay();
    const skipSunday = excluirDomingos && dow === 0;
    const skipHoliday =
      excluirFeriados && isHolidayDate(cursor, { usarFeriadosPeru, feriadosExtra });

    if (!skipSunday && !skipHoliday) {
      const windowStart = new Date(cursor.getTime() + hpStartHour * 3600000);
      const windowEnd = new Date(cursor.getTime() + hpEndHour * 3600000);

      const overlapStart = Math.max(start.getTime(), windowStart.getTime());
      const overlapEnd = Math.min(end.getTime(), windowEnd.getTime());
      if (overlapEnd > overlapStart) {
        totalHours += (overlapEnd - overlapStart) / 3600000;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return Number(totalHours.toFixed(2));
}
