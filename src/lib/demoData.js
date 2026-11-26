import { subDays } from 'date-fns';

const STORAGE_KEY = 'hidroluz_demo_db_v1';
const CHANNEL_NAME = 'hidroluz_realtime_demo';

function createSampleSvgPhoto(label, value, unit, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#0f172a"/>
    <rect x="40" y="40" width="560" height="320" rx="24" fill="#1e293b" stroke="${color}" stroke-width="3"/>
    <text x="80" y="105" fill="#94a3b8" font-family="monospace" font-size="20">EVIDENCIA DE MEDIDOR - ${label}</text>
    <rect x="80" y="140" width="480" height="110" rx="14" fill="#020617" stroke="#334155" stroke-width="2"/>
    <text x="320" y="214" text-anchor="middle" fill="#f8fafc" font-family="monospace" font-weight="bold" font-size="52">${value} ${unit}</text>
    <text x="80" y="310" fill="${color}" font-family="sans-serif" font-size="18">Verificado digitalmente · HidroLuz Control</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildInitialDemoDatabase() {
  const now = new Date();

  const sedes = [
    {
      id: 'sede-central',
      nombre: 'Sede Central Miraflores',
      codigo: 'LIM-01',
      direccion: 'Av. Arequipa 2450',
      ciudad: 'Lima',
      activa: true,
      created_at: subDays(now, 30).toISOString(),
    },
    {
      id: 'sede-norte',
      nombre: 'Planta Industrial Norte',
      codigo: 'TRU-02',
      direccion: 'Panamericana Norte Km 562',
      ciudad: 'Trujillo',
      activa: true,
      created_at: subDays(now, 28).toISOString(),
    },
    {
      id: 'sede-sur',
      nombre: 'Centro Logístico Sur',
      codigo: 'AQP-03',
      direccion: 'Parque Industrial Río Seco Mz D',
      ciudad: 'Arequipa',
      activa: true,
      created_at: subDays(now, 25).toISOString(),
    },
  ];

  const users = [
    {
      id: 'user-sysadmin',
      dni: '00000000',
      nombre_completo: 'Administrador General (Sysadmin)',
      rol: 'sysadmin',
      sede_id: null,
      activo: true,
      created_at: subDays(now, 30).toISOString(),
    },
    {
      id: 'user-op-central',
      dni: '12345678',
      nombre_completo: 'Carlos Mendoza (Sede Central)',
      rol: 'operario',
      sede_id: 'sede-central',
      activo: true,
      created_at: subDays(now, 25).toISOString(),
    },
    {
      id: 'user-op-norte',
      dni: '87654321',
      nombre_completo: 'Lucía Paredes (Planta Norte)',
      rol: 'operario',
      sede_id: 'sede-norte',
      activo: true,
      created_at: subDays(now, 24).toISOString(),
    },
    {
      id: 'user-op-sur',
      dni: '45678912',
      nombre_completo: 'Jorge Quispe (Logístico Sur)',
      rol: 'operario',
      sede_id: 'sede-sur',
      activo: true,
      created_at: subDays(now, 20).toISOString(),
    },
  ];

  const meters = [
    {
      id: 'm-central-luz',
      sede_id: 'sede-central',
      tipo: 'luz',
      nombre: 'Medidor Principal Luz',
      numero_serie: 'EL-99201',
      unidad: 'kWh',
      umbral_diario_max: 160,
      porcentaje_alerta_promedio: 30,
      activo: true,
      created_at: subDays(now, 30).toISOString(),
    },
    {
      id: 'm-central-agua',
      sede_id: 'sede-central',
      tipo: 'agua',
      nombre: 'Medidor Principal Agua',
      numero_serie: 'AG-44012',
      unidad: 'm3',
      umbral_diario_max: 22,
      porcentaje_alerta_promedio: 30,
      activo: true,
      created_at: subDays(now, 30).toISOString(),
    },
    {
      id: 'm-norte-luz',
      sede_id: 'sede-norte',
      tipo: 'luz',
      nombre: 'Subestación Planta Luz',
      numero_serie: 'EL-77810',
      unidad: 'kWh',
      umbral_diario_max: 320,
      porcentaje_alerta_promedio: 30,
      activo: true,
      created_at: subDays(now, 28).toISOString(),
    },
    {
      id: 'm-norte-agua',
      sede_id: 'sede-norte',
      tipo: 'agua',
      nombre: 'Toma Industrial Agua',
      numero_serie: 'AG-88219',
      unidad: 'm3',
      umbral_diario_max: 45,
      porcentaje_alerta_promedio: 30,
      activo: true,
      created_at: subDays(now, 28).toISOString(),
    },
    {
      id: 'm-sur-luz',
      sede_id: 'sede-sur',
      tipo: 'luz',
      nombre: 'Tablero General Luz',
      numero_serie: 'EL-55019',
      unidad: 'kWh',
      umbral_diario_max: 140,
      porcentaje_alerta_promedio: 30,
      activo: true,
      created_at: subDays(now, 25).toISOString(),
    },
    {
      id: 'm-sur-agua',
      sede_id: 'sede-sur',
      tipo: 'agua',
      nombre: 'Medidor Red Agua',
      numero_serie: 'AG-31004',
      unidad: 'm3',
      umbral_diario_max: 18,
      porcentaje_alerta_promedio: 30,
      activo: true,
      created_at: subDays(now, 25).toISOString(),
    },
  ];

  const readings = [];
  const alerts = [];

  const configs = [
    {
      meter: meters[0],
      user: users[1],
      base: 14200,
      dailyPattern: [122, 128, 119, 134, 125, 130, 127, 132, 129, 198],
    },
    {
      meter: meters[1],
      user: users[1],
      base: 840,
      dailyPattern: [15.2, 16.0, 14.8, 15.6, 16.4, 15.1, 15.9, 16.2, 15.5, 16.8],
    },
    {
      meter: meters[2],
      user: users[2],
      base: 48500,
      dailyPattern: [265, 278, 270, 284, 260, 274, 281, 276, 269, 288],
    },
    {
      meter: meters[3],
      user: users[2],
      base: 2150,
      dailyPattern: [32, 34, 31, 35, 33, 34.5, 32.8, 33.4, 54.2, 35.1],
    },
    {
      meter: meters[4],
      user: users[3],
      base: 9100,
      dailyPattern: [95, 102, 98, 104, 96, 101, 99, 103, 100, 105],
    },
    {
      meter: meters[5],
      user: users[3],
      base: 510,
      dailyPattern: [11.4, 12.1, 11.8, 12.5, 11.2, 11.9, 12.3, 11.7, 12.0, 12.4],
    },
  ];

  configs.forEach(({ meter, user, base, dailyPattern }) => {
    let runningValue = base;
    let prevValue = null;
    const recentConsumptions = [];

    dailyPattern.forEach((dailyInc, idx) => {
      const daysAgo = dailyPattern.length - 1 - idx;
      const dateIso = subDays(now, daysAgo).toISOString();
      if (idx > 0) {
        runningValue = Number((runningValue + dailyInc).toFixed(2));
      }

      const consumoDiario = idx === 0 ? 0 : dailyInc;
      const avgPrev =
        recentConsumptions.length > 0
          ? Number(
              (
                recentConsumptions.reduce((s, n) => s + n, 0) / recentConsumptions.length
              ).toFixed(2)
            )
          : null;

      const overThreshold =
        idx > 0 && meter.umbral_diario_max && consumoDiario > meter.umbral_diario_max;
      const overAvg =
        idx > 2 && avgPrev && consumoDiario > avgPrev * 1.3;
      const esAnomalo = Boolean(overThreshold || overAvg);

      let motivo = null;
      if (overThreshold) {
        motivo = `Consumo diario (${consumoDiario} ${meter.unidad}/día) supera el límite máximo de ${meter.umbral_diario_max} ${meter.unidad}/día.`;
      } else if (overAvg) {
        motivo = `Supera más del 30% sobre el promedio diario reciente (${avgPrev} ${meter.unidad}/día).`;
      }

      const readingId = `r-${meter.id}-${idx}`;
      readings.push({
        id: readingId,
        sede_id: meter.sede_id,
        meter_id: meter.id,
        user_id: user.id,
        usuario_nombre: user.nombre_completo,
        usuario_dni: user.dni,
        tipo: meter.tipo,
        valor_lectura: runningValue,
        lectura_anterior: prevValue,
        dias_transcurridos: 1,
        consumo_total_periodo: consumoDiario,
        consumo_diario: consumoDiario,
        promedio_previo: avgPrev,
        es_anomalo: esAnomalo,
        motivo_anomalia: motivo,
        media_url:
          idx >= dailyPattern.length - 2
            ? createSampleSvgPhoto(
                meter.nombre,
                runningValue,
                meter.unidad,
                meter.tipo === 'luz' ? '#facc15' : '#38bdf8'
              )
            : null,
        media_path: null,
        media_tipo: idx >= dailyPattern.length - 2 ? 'foto' : null,
        observaciones: esAnomalo
          ? 'Incremento inusual detectado durante turno operativo.'
          : 'Lectura diaria normal verificada.',
        fecha_lectura: dateIso,
        created_at: dateIso,
      });

      if (esAnomalo) {
        const sedeObj = sedes.find((s) => s.id === meter.sede_id);
        alerts.push({
          id: `al-${readingId}`,
          sede_id: meter.sede_id,
          meter_id: meter.id,
          reading_id: readingId,
          tipo_alerta: overThreshold ? 'exceso_umbral' : 'exceso_promedio',
          severidad: 'alta',
          titulo: `Consumo excesivo de ${meter.tipo.toUpperCase()} en ${sedeObj?.nombre || 'Sede'}`,
          mensaje: motivo,
          resuelta: false,
          resuelta_por: null,
          resuelta_at: null,
          created_at: dateIso,
        });
      }

      if (consumoDiario > 0) {
        recentConsumptions.push(consumoDiario);
      }
      prevValue = runningValue;
    });
  });

  return { sedes, users, meters, readings, alerts };
}

export function loadDemoDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore storage errors
  }
  const initial = buildInitialDemoDatabase();
  saveDemoDb(initial, false);
  return initial;
}

export function saveDemoDb(db, notify = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Almacenamiento local casi lleno:', err);
  }
  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hidroluz-demo-update'));
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage({ type: 'DB_UPDATED', ts: Date.now() });
      bc.close();
    }
  }
}

export function resetDemoDb() {
  const initial = buildInitialDemoDatabase();
  saveDemoDb(initial, true);
  return initial;
}

export function subscribeDemoRealtime(callback) {
  const handler = () => callback();
  window.addEventListener('hidroluz-demo-update', handler);

  let bc = null;
  if ('BroadcastChannel' in window) {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = () => callback();
  }

  return () => {
    window.removeEventListener('hidroluz-demo-update', handler);
    if (bc) bc.close();
  };
}
