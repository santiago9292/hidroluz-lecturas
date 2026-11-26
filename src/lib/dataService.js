import { supabase, isSupabaseConfigured } from './supabase';
import {
  decideAlertPersistence,
  evaluateAlertsForReading,
  evaluateMissingReadingsAlerts,
  sanitizeDni,
  validateReadingBeforeSave,
} from './consumption';
import {
  DEFAULT_TRIFASICO_CODES,
  buildDefaultTariffConfig,
  encodeMeterSerieFallback,
  encodeReadingObsFallback,
  normalizeMeterConfig,
  normalizeMeterObis,
  normalizeReadingObis,
} from './obis';
import { loadDemoDb, saveDemoDb, subscribeDemoRealtime } from './demoData';
import { triggerNativeAlertNotification } from './pushClient';

function uid(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function isSchemaFallbackNeeded(error) {
  if (!error) return false;
  const msg = String(error.message || '');
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    error.code === '23514' ||
    msg.includes('es_trifasico') ||
    msg.includes('codigos_obis') ||
    msg.includes('config_tarifaria') ||
    msg.includes('valor_crudo') ||
    msg.includes('lecturas_obis') ||
    msg.includes('calculos') ||
    msg.includes('evento_lectura') ||
    msg.includes('codigo_regla') ||
    msg.includes('periodo_key') ||
    msg.includes('alerts_tipo_alerta_check') ||
    msg.includes('alerts_severidad_check')
  );
}

function mapLegacyAlertColumns(alertObj) {
  const legacyTypeMap = {
    consumo_desvio_4sem: 'exceso_promedio',
    demanda_vs_5m_total: 'exceso_umbral',
    demanda_vs_5m_hp: 'exceso_umbral',
    calificacion_tarifaria: 'exceso_umbral',
    reactiva_porcentaje: 'exceso_umbral',
    consumo_cero_laborable: 'salto_extremo',
    sin_lectura_24h: 'salto_extremo',
  };
  const legacySeverity = alertObj.severidad === 'roja' ? 'alta' : 'media';

  return {
    sede_id: alertObj.sede_id,
    meter_id: alertObj.meter_id,
    reading_id: alertObj.reading_id,
    tipo_alerta: legacyTypeMap[alertObj.codigo_regla] || 'exceso_umbral',
    severidad: legacySeverity,
    titulo: `[${(alertObj.severidad || 'AVISO').toUpperCase()}] ${alertObj.titulo}`,
    mensaje: `[R:${alertObj.codigo_regla}|P:${alertObj.periodo_key}|V:${alertObj.valor_detectado}|U:${alertObj.umbral_referencia}] ${alertObj.mensaje}`,
    resuelta: false,
  };
}

function normalizeAlertRow(alertRow) {
  if (!alertRow) return alertRow;
  if (alertRow.codigo_regla && alertRow.causa) return alertRow;

  // Extraer metadatos si provienen del modo fallback previo a migración 004
  const msg = String(alertRow.mensaje || '');
  const metaMatch = msg.match(/^\[R:([^|]*)\|P:([^|]*)\|V:([^|]*)\|U:([^\]]*)\]\s*(.*)$/);
  if (metaMatch) {
    const [, regla, periodo, val, umb, restMsg] = metaMatch;
    const sevMatch = String(alertRow.titulo || '').match(/^\[(ROJA|AMBAR|AVISO)\]\s*(.*)$/i);
    const parsedSev = sevMatch ? sevMatch[1].toLowerCase() : alertRow.severidad;
    const cleanTitle = sevMatch ? sevMatch[2] : alertRow.titulo;

    const causaMatch = restMsg.match(/Causa:\s*(.*?)\s*Acción:\s*(.*)$/);

    return {
      ...alertRow,
      titulo: cleanTitle,
      severidad: parsedSev,
      codigo_regla: regla || alertRow.tipo_alerta,
      periodo_key: periodo || null,
      valor_detectado: val !== 'null' && val !== '' ? Number(val) : null,
      umbral_referencia: umb !== 'null' && umb !== '' ? Number(umb) : null,
      causa: causaMatch ? causaMatch[1] : restMsg,
      accion_sugerida: causaMatch ? causaMatch[2] : null,
      mensaje: restMsg,
    };
  }

  return {
    ...alertRow,
    codigo_regla: alertRow.codigo_regla || alertRow.tipo_alerta,
  };
}

/**
 * 1. INICIO DE SESIÓN RÁPIDO CON DNI
 */
export async function loginWithDni(rawDni) {
  const dni = sanitizeDni(rawDni);
  if (!dni || dni.length < 4) {
    throw new Error('Ingresa un número de DNI válido.');
  }

  if (isSupabaseConfigured) {
    const { data: user, error } = await supabase
      .from('users_app')
      .select('*, sede:sedes(*)')
      .eq('dni', dni)
      .maybeSingle();

    if (error) {
      throw new Error(`Error consultando Supabase: ${error.message}`);
    }
    if (!user) {
      throw new Error('El DNI ingresado no se encuentra registrado. Solicita acceso al Sysadmin.');
    }
    if (!user.activo) {
      throw new Error('Tu usuario se encuentra desactivado temporalmente.');
    }
    if (user.rol !== 'sysadmin' && !user.sede_id) {
      throw new Error('Tu usuario aún no tiene una sede asignada. Contacta al Sysadmin.');
    }
    return user;
  }

  const db = loadDemoDb();
  const found = db.users.find((u) => u.dni === dni);
  if (!found) {
    throw new Error(
      'DNI no encontrado. Prueba con 00000000 (Sysadmin) o 12345678 / 87654321 (Operarios).'
    );
  }
  if (!found.activo) {
    throw new Error('Este usuario se encuentra inactivo.');
  }
  if (found.rol !== 'sysadmin' && !found.sede_id) {
    throw new Error('Tu usuario no tiene sede asignada. Contacta al Sysadmin.');
  }
  const sede = db.sedes.find((s) => s.id === found.sede_id) || null;
  return { ...found, sede };
}

/**
 * Persiste o escala una alerta evitando duplicarla en el mismo periodo salvo que empeore.
 */
async function persistAlertIfNeeded(candidate, existingAlerts = []) {
  const decision = decideAlertPersistence(candidate, existingAlerts);
  if (decision.action === 'skip') return null;

  if (isSupabaseConfigured) {
    const richPayload = {
      sede_id: candidate.sede_id,
      meter_id: candidate.meter_id,
      reading_id: candidate.reading_id || null,
      tipo_alerta: candidate.tipo_alerta,
      codigo_regla: candidate.codigo_regla,
      periodo_key: candidate.periodo_key,
      severidad: candidate.severidad,
      valor_detectado: candidate.valor_detectado,
      umbral_referencia: candidate.umbral_referencia,
      titulo: candidate.titulo,
      causa: candidate.causa,
      accion_sugerida: candidate.accion_sugerida,
      mensaje: candidate.mensaje,
      resuelta: false,
    };

    if (decision.action === 'update' && decision.existingId) {
      let { data, error } = await supabase
        .from('alerts')
        .update(richPayload)
        .eq('id', decision.existingId)
        .select('*')
        .maybeSingle();

      if (error && isSchemaFallbackNeeded(error)) {
        const fallback = mapLegacyAlertColumns(candidate);
        const retry = await supabase
          .from('alerts')
          .update(fallback)
          .eq('id', decision.existingId)
          .select('*')
          .maybeSingle();
        data = retry.data;
      }
      return normalizeAlertRow(data);
    }

    let { data, error } = await supabase
      .from('alerts')
      .insert(richPayload)
      .select('*')
      .maybeSingle();

    if (error && isSchemaFallbackNeeded(error)) {
      const fallback = mapLegacyAlertColumns(candidate);
      const retry = await supabase.from('alerts').insert(fallback).select('*').maybeSingle();
      data = retry.data;
    }
    return normalizeAlertRow(data);
  }

  // Modo Demo Local
  const db = loadDemoDb();
  if (decision.action === 'update' && decision.existingId) {
    let updatedItem = null;
    db.alerts = db.alerts.map((a) => {
      if (a.id === decision.existingId) {
        updatedItem = { ...a, ...candidate, created_at: new Date().toISOString() };
        return updatedItem;
      }
      return a;
    });
    saveDemoDb(db, false);
    return updatedItem;
  }

  const created = {
    id: uid('alert'),
    ...candidate,
    resuelta: false,
    resuelta_por: null,
    resuelta_at: null,
    created_at: new Date().toISOString(),
  };
  db.alerts.unshift(created);
  saveDemoDb(db, false);
  return created;
}

/**
 * 2. CARGA COMPLETA DE DATOS SEGÚN ROL Y SEDE + VERIFICACIÓN DE >24H SIN LECTURA
 */
export async function fetchAllAppData(currentUser) {
  if (!currentUser) {
    return { sedes: [], meters: [], readings: [], alerts: [], users: [] };
  }

  const isSysadmin = currentUser.rol === 'sysadmin';

  if (isSupabaseConfigured) {
    let sedesQ = supabase.from('sedes').select('*').order('nombre');
    let metersQ = supabase.from('meters').select('*').order('tipo').order('nombre');
    let readingsQ = supabase
      .from('readings')
      .select('*')
      .order('fecha_lectura', { ascending: false })
      .limit(800);
    let alertsQ = supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);

    if (!isSysadmin && currentUser.sede_id) {
      sedesQ = sedesQ.eq('id', currentUser.sede_id);
      metersQ = metersQ.eq('sede_id', currentUser.sede_id);
      readingsQ = readingsQ.eq('sede_id', currentUser.sede_id);
      alertsQ = alertsQ.eq('sede_id', currentUser.sede_id);
    }

    const promises = [sedesQ, metersQ, readingsQ, alertsQ];
    if (isSysadmin) {
      promises.push(supabase.from('users_app').select('*').order('created_at', { ascending: false }));
    }

    const results = await Promise.all(promises);
    const sedes = results[0].data || [];
    const meters = (results[1].data || []).map(normalizeMeterObis);
    const readings = (results[2].data || []).map(normalizeReadingObis);
    let alerts = (results[3].data || []).map(normalizeAlertRow);
    const users = isSysadmin ? results[4].data || [] : [];

    // Evaluar sedes / medidores sin lectura > 24 h sin duplicar avisos
    const missingCandidates = evaluateMissingReadingsAlerts({
      sedes,
      meters,
      readings,
      now: new Date(),
    });

    for (const mc of missingCandidates) {
      const meterAlerts = alerts.filter((a) => a.meter_id === mc.meter_id);
      const savedMissing = await persistAlertIfNeeded(mc, meterAlerts);
      if (savedMissing) {
        alerts = [savedMissing, ...alerts.filter((a) => a.id !== savedMissing.id)];
      }
    }

    let updatedUser = currentUser;
    const { data: freshProfile } = await supabase
      .from('users_app')
      .select('*, sede:sedes(*)')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (freshProfile) updatedUser = freshProfile;

    return { sedes, meters, readings, alerts, users, updatedUser };
  }

  const db = loadDemoDb();
  const freshLocal = db.users.find((u) => u.id === currentUser.id) || currentUser;
  const updatedUser = {
    ...freshLocal,
    sede: db.sedes.find((s) => s.id === freshLocal.sede_id) || null,
  };

  const sedes = isSysadmin
    ? db.sedes
    : db.sedes.filter((s) => s.id === updatedUser.sede_id);
  const meters = (
    isSysadmin
      ? db.meters
      : db.meters.filter((m) => m.sede_id === updatedUser.sede_id)
  ).map(normalizeMeterObis);
  const readings = (
    isSysadmin
      ? db.readings
      : db.readings.filter((r) => r.sede_id === updatedUser.sede_id)
  )
    .map(normalizeReadingObis)
    .sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime());

  let alerts = (
    isSysadmin
      ? db.alerts
      : db.alerts.filter((a) => a.sede_id === updatedUser.sede_id)
  )
    .map(normalizeAlertRow)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const missingCandidates = evaluateMissingReadingsAlerts({
    sedes,
    meters,
    readings,
    now: new Date(),
  });
  for (const mc of missingCandidates) {
    const meterAlerts = alerts.filter((a) => a.meter_id === mc.meter_id);
    const savedMissing = await persistAlertIfNeeded(mc, meterAlerts);
    if (savedMissing) {
      alerts = [savedMissing, ...alerts.filter((a) => a.id !== savedMissing.id)];
    }
  }

  const users = isSysadmin ? db.users : [];
  return { sedes, meters, readings, alerts, users, updatedUser };
}

/**
 * 3. SUBIDA DE FOTO O VIDEO DE EVIDENCIA A SUPABASE STORAGE (`evidencias`)
 */
export async function uploadMeterMedia({ file, sedeId, meterId }) {
  if (!file) return { mediaUrl: null, mediaPath: null, mediaTipo: null };

  const isVideo = file.type.startsWith('video/');
  const mediaTipo = isVideo ? 'video' : 'foto';

  if (file.size > 50 * 1024 * 1024) {
    throw new Error('El archivo supera el límite máximo permitido de 50 MB.');
  }

  if (isSupabaseConfigured) {
    const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
    const safePath = `${sedeId}/${meterId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('evidencias')
      .upload(safePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(`Error subiendo evidencia a Supabase Storage: ${uploadError.message}`);
    }

    const { data: pubData } = supabase.storage.from('evidencias').getPublicUrl(safePath);
    return {
      mediaUrl: pubData.publicUrl,
      mediaPath: safePath,
      mediaTipo,
    };
  }

  if (!isVideo && file.size <= 3 * 1024 * 1024) {
    const dataUrl = await fileToDataUrl(file);
    return { mediaUrl: dataUrl, mediaPath: null, mediaTipo };
  }
  const blobUrl = URL.createObjectURL(file);
  return { mediaUrl: blobUrl, mediaPath: null, mediaTipo };
}

/**
 * 4. REGISTRAR LECTURA (PRESERVA CRUDO INTACTO, VALIDA ANTES DE GUARDAR Y DEDUPLICA ALERTAS)
 */
export async function registerMeterReading({
  currentUser,
  sede,
  meter,
  valorLectura,
  obisValues = null,
  fechaLectura,
  observaciones,
  file,
  previousReadings = [],
  existingAlerts = [],
  confirmation = {},
}) {
  if (!currentUser) throw new Error('Sesión no válida.');
  if (currentUser.rol !== 'sysadmin' && currentUser.sede_id !== sede.id) {
    throw new Error('Solo puedes registrar lecturas correspondientes a tu propia sede.');
  }

  const normMeter = normalizeMeterObis(meter);
  const isTrifasico = Boolean(normMeter.es_trifasico && normMeter.tipo === 'luz');
  const isoDate = fechaLectura ? new Date(fechaLectura).toISOString() : new Date().toISOString();

  // Conservar formato exacto con ceros (ej. "183.40" en Luz) tanto en JSONB como en pantalla
  let rawObisClean = null;
  if (isTrifasico && obisValues) {
    rawObisClean = {};
    Object.entries(obisValues).forEach(([code, val]) => {
      if (val !== '' && val !== null && val !== undefined && !Number.isNaN(Number(val))) {
        rawObisClean[code] = Number(val).toFixed(2);
      }
    });
  }

  const rawSingleValue = !isTrifasico && valorLectura !== '' ? Number(valorLectura) : null;

  // Ejecutar validaciones estrictas antes de subir o insertar
  const validation = validateReadingBeforeSave({
    valorCrudo: rawSingleValue,
    obisValues: rawObisClean,
    fechaLectura: isoDate,
    meter: normMeter,
    previousReadings,
    hasMedia: Boolean(file),
    confirmation,
  });

  if (!validation.valid) {
    const firstIssue = validation.blockingIssues[0];
    const err = new Error(firstIssue?.message || 'La lectura requiere confirmación antes de guardar.');
    err.validation = validation;
    throw err;
  }

  const step = validation.step;
  const eventoLectura =
    confirmation?.motivoEnergiaMenor ||
    (step.abreNuevoPeriodoDemanda ? 'reinicio_demanda' : null) ||
    (confirmation?.confirmarBajaDemandaMitad ? 'demanda_revisada' : null) ||
    (confirmation?.confirmarSalto ? 'salto_confirmado' : null);

  const { mediaUrl, mediaPath, mediaTipo } = await uploadMeterMedia({
    file,
    sedeId: sede.id,
    meterId: normMeter.id,
  });

  // `valor_crudo` y `lecturas_obis` guardan el valor crudo sin sobrescribirlo nunca
  const legacyReadingBase = {
    sede_id: sede.id,
    meter_id: normMeter.id,
    user_id: currentUser.id,
    usuario_nombre: currentUser.nombre_completo,
    usuario_dni: currentUser.dni,
    tipo: normMeter.tipo,
    valor_lectura: step.valorCrudoPrimario,
    lectura_anterior: step.prevValorCrudoPrimario,
    dias_transcurridos: step.diasEquivalentes || 1,
    consumo_total_periodo: step.consumoTotal,
    consumo_diario: step.promedioDiario,
    promedio_previo: null,
    es_anomalo: false,
    motivo_anomalia: null,
    media_url: mediaUrl,
    media_path: mediaPath,
    media_tipo: mediaTipo,
    observaciones: observaciones?.trim() || null,
    fecha_lectura: isoDate,
  };

  let savedReading = null;

  if (isSupabaseConfigured) {
    const richPayload = {
      ...legacyReadingBase,
      valor_crudo: step.valorCrudoPrimario,
      lecturas_obis: rawObisClean,
      calculos: step,
      evento_lectura: eventoLectura,
    };

    let { data: inserted, error } = await supabase
      .from('readings')
      .insert(richPayload)
      .select('*')
      .single();

    if (error && isSchemaFallbackNeeded(error)) {
      const fallbackPayload = {
        ...legacyReadingBase,
        observaciones: encodeReadingObsFallback(observaciones, {
          lecturasObis: rawObisClean,
          valorCrudo: step.valorCrudoPrimario,
          calculos: step,
          eventoLectura,
        }),
      };
      const retry = await supabase.from('readings').insert(fallbackPayload).select('*').single();
      inserted = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    savedReading = normalizeReadingObis(inserted);
  } else {
    const db = loadDemoDb();
    savedReading = {
      id: uid('read'),
      ...legacyReadingBase,
      valor_crudo: step.valorCrudoPrimario,
      lecturas_obis: rawObisClean,
      calculos: step,
      evento_lectura: eventoLectura,
      created_at: new Date().toISOString(),
    };
    db.readings.unshift(savedReading);
    saveDemoDb(db, false);
  }

  // Evaluar todas las reglas de alertas del periodo y deduplicar
  const candidateAlerts = evaluateAlertsForReading({
    allMeterReadings: previousReadings,
    newReading: savedReading,
    meter: normMeter,
    sedeNombre: sede.nombre,
  });

  const meterExistingAlerts = existingAlerts.filter((a) => a.meter_id === normMeter.id);
  const persistedAlerts = [];

  for (const cand of candidateAlerts) {
    const savedAlert = await persistAlertIfNeeded(
      {
        ...cand,
        sede_id: sede.id,
        meter_id: normMeter.id,
        reading_id: savedReading.id,
      },
      meterExistingAlerts
    );
    if (savedAlert) {
      persistedAlerts.push(savedAlert);
    }
  }

  // Marcar lectura como anómala si disparó alerta ámbar o roja
  const primaryAlert =
    persistedAlerts.find((a) => a.severidad === 'roja') ||
    persistedAlerts.find((a) => a.severidad === 'ambar') ||
    persistedAlerts[0] ||
    null;

  if (candidateAlerts.length > 0) {
    const topCand = candidateAlerts[0];
    if (isSupabaseConfigured) {
      await supabase
        .from('readings')
        .update({
          es_anomalo: topCand.severidad === 'roja' || topCand.severidad === 'ambar',
          motivo_anomalia: topCand.causa,
        })
        .eq('id', savedReading.id);
    } else {
      const db = loadDemoDb();
      db.readings = db.readings.map((r) =>
        r.id === savedReading.id
          ? {
              ...r,
              es_anomalo: topCand.severidad === 'roja' || topCand.severidad === 'ambar',
              motivo_anomalia: topCand.causa,
            }
          : r
      );
      saveDemoDb(db, true);
    }
  } else if (!isSupabaseConfigured) {
    saveDemoDb(loadDemoDb(), true);
  }

  if (primaryAlert) {
    triggerNativeAlertNotification({
      title: `⚠️ ${primaryAlert.titulo}`,
      body: `${primaryAlert.causa} · Acción: ${primaryAlert.accion_sugerida || ''}`,
      url: '/alertas',
      severity: primaryAlert.severidad === 'roja' ? 'alta' : 'media',
      sedeId: sede.id,
    }).catch(() => undefined);
  }

  return {
    reading: savedReading,
    alert: primaryAlert,
    alerts: persistedAlerts,
    notices: validation.notices,
    evaluation: step,
  };
}

/**
 * 5. GESTIÓN DE ALERTAS
 */
export async function markAlertResolved(alertId, userId) {
  const nowIso = new Date().toISOString();
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('alerts')
      .update({ resuelta: true, resuelta_por: userId, resuelta_at: nowIso })
      .eq('id', alertId);
    if (error) throw new Error(error.message);
    return;
  }

  const db = loadDemoDb();
  db.alerts = db.alerts.map((a) =>
    a.id === alertId ? { ...a, resuelta: true, resuelta_por: userId, resuelta_at: nowIso } : a
  );
  saveDemoDb(db, true);
}

/**
 * 6. SYSADMIN — CRUD DE SEDES Y MEDIDORES CON CONFIGURACIÓN TARIFARIA COMPLETA
 */
export async function saveSedeAdmin({
  id = null,
  nombre,
  codigo,
  direccion,
  ciudad,
  activa = true,
  umbralLuz = null,
  umbralAgua = null,
  luzTrifasico = true,
  tarifaLuz = 'BT3',
}) {
  const cleanCode = codigo.trim().toUpperCase();
  if (!nombre.trim() || !cleanCode) {
    throw new Error('Nombre y código de sede son obligatorios.');
  }

  if (isSupabaseConfigured) {
    if (id) {
      const { data, error } = await supabase
        .from('sedes')
        .update({
          nombre: nombre.trim(),
          codigo: cleanCode,
          direccion: direccion?.trim() || null,
          ciudad: ciudad?.trim() || null,
          activa,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { data: createdSede, error } = await supabase
      .from('sedes')
      .insert({
        nombre: nombre.trim(),
        codigo: cleanCode,
        direccion: direccion?.trim() || null,
        ciudad: ciudad?.trim() || null,
        activa: true,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    const luzCfg = {
      ...buildDefaultTariffConfig('luz', Boolean(luzTrifasico)),
      tarifa: luzTrifasico ? tarifaLuz || 'BT3' : 'BT5',
    };

    await saveMeterAdmin({
      sede_id: createdSede.id,
      tipo: 'luz',
      nombre: luzTrifasico ? 'Medidor Trifásico Luz' : 'Medidor Principal Luz',
      numero_serie: `LUZ-${cleanCode}`,
      umbral_diario_max: umbralLuz ? Number(umbralLuz) : null,
      es_trifasico: Boolean(luzTrifasico),
      codigos_obis: luzTrifasico ? DEFAULT_TRIFASICO_CODES : null,
      config_tarifaria: luzCfg,
      activo: true,
    });

    await saveMeterAdmin({
      sede_id: createdSede.id,
      tipo: 'agua',
      nombre: 'Medidor Principal Agua',
      numero_serie: `AGUA-${cleanCode}`,
      umbral_diario_max: umbralAgua ? Number(umbralAgua) : null,
      es_trifasico: false,
      codigos_obis: null,
      config_tarifaria: buildDefaultTariffConfig('agua', false),
      activo: true,
    });

    return createdSede;
  }

  const db = loadDemoDb();
  if (id) {
    db.sedes = db.sedes.map((s) =>
      s.id === id
        ? {
            ...s,
            nombre: nombre.trim(),
            codigo: cleanCode,
            direccion: direccion?.trim() || null,
            ciudad: ciudad?.trim() || null,
            activa,
          }
        : s
    );
    saveDemoDb(db, true);
    return db.sedes.find((s) => s.id === id);
  }

  const newSede = {
    id: uid('sede'),
    nombre: nombre.trim(),
    codigo: cleanCode,
    direccion: direccion?.trim() || null,
    ciudad: ciudad?.trim() || null,
    activa: true,
    created_at: new Date().toISOString(),
  };
  db.sedes.push(newSede);
  db.meters.push(
    {
      id: uid('meter'),
      sede_id: newSede.id,
      tipo: 'luz',
      nombre: luzTrifasico ? 'Medidor Trifásico Luz' : 'Medidor Principal Luz',
      numero_serie: `LUZ-${cleanCode}`,
      unidad: 'kWh',
      umbral_diario_max: umbralLuz ? Number(umbralLuz) : null,
      porcentaje_alerta_promedio: 20,
      es_trifasico: Boolean(luzTrifasico),
      codigos_obis: luzTrifasico ? DEFAULT_TRIFASICO_CODES : null,
      config_tarifaria: buildDefaultTariffConfig('luz', Boolean(luzTrifasico)),
      activo: true,
      created_at: new Date().toISOString(),
    },
    {
      id: uid('meter'),
      sede_id: newSede.id,
      tipo: 'agua',
      nombre: 'Medidor Principal Agua',
      numero_serie: `AGUA-${cleanCode}`,
      unidad: 'm3',
      umbral_diario_max: umbralAgua ? Number(umbralAgua) : null,
      porcentaje_alerta_promedio: 20,
      es_trifasico: false,
      codigos_obis: null,
      config_tarifaria: buildDefaultTariffConfig('agua', false),
      activo: true,
      created_at: new Date().toISOString(),
    }
  );
  saveDemoDb(db, true);
  return newSede;
}

export async function deleteSedeAdmin(sedeId) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('sedes').delete().eq('id', sedeId);
    if (error) throw new Error(error.message);
    return;
  }
  const db = loadDemoDb();
  db.sedes = db.sedes.filter((s) => s.id !== sedeId);
  db.meters = db.meters.filter((m) => m.sede_id !== sedeId);
  db.readings = db.readings.filter((r) => r.sede_id !== sedeId);
  db.alerts = db.alerts.filter((a) => a.sede_id !== sedeId);
  db.users = db.users.map((u) => (u.sede_id === sedeId ? { ...u, sede_id: null } : u));
  saveDemoDb(db, true);
}

export async function saveMeterAdmin({
  id = null,
  sede_id,
  tipo,
  nombre,
  numero_serie,
  umbral_diario_max = null,
  porcentaje_alerta_promedio = 20,
  es_trifasico = false,
  codigos_obis = null,
  config_tarifaria = null,
  activo = true,
}) {
  const unidad = tipo === 'luz' ? 'kWh' : 'm3';
  const useTrifasico = tipo === 'luz' && Boolean(es_trifasico);
  const activeObis = useTrifasico
    ? Array.isArray(codigos_obis) && codigos_obis.length > 0
      ? codigos_obis.filter((c) => c.code?.trim())
      : DEFAULT_TRIFASICO_CODES
    : null;

  const cleanCfg = normalizeMeterConfig({
    tipo,
    es_trifasico: useTrifasico,
    config_tarifaria,
  });

  const basePayload = {
    sede_id,
    tipo,
    nombre: nombre.trim(),
    numero_serie: numero_serie?.trim() || null,
    unidad,
    umbral_diario_max:
      umbral_diario_max !== '' && umbral_diario_max !== null && umbral_diario_max !== undefined
        ? Number(umbral_diario_max)
        : null,
    porcentaje_alerta_promedio: Number(
      cleanCfg.umbrales?.consumo_ambar_pct ?? porcentaje_alerta_promedio ?? 20
    ),
    activo,
  };

  if (isSupabaseConfigured) {
    const jsonbPayload = {
      ...basePayload,
      es_trifasico: useTrifasico,
      codigos_obis: activeObis,
      config_tarifaria: cleanCfg,
    };

    if (id) {
      let { error } = await supabase.from('meters').update(jsonbPayload).eq('id', id);
      if (error && isSchemaFallbackNeeded(error)) {
        const fallback = {
          ...basePayload,
          numero_serie: encodeMeterSerieFallback(
            numero_serie,
            useTrifasico,
            activeObis,
            cleanCfg
          ),
        };
        const retry = await supabase.from('meters').update(fallback).eq('id', id);
        error = retry.error;
      }
      if (error) throw new Error(error.message);
      return;
    }

    let { error } = await supabase.from('meters').insert(jsonbPayload);
    if (error && isSchemaFallbackNeeded(error)) {
      const fallback = {
        ...basePayload,
        numero_serie: encodeMeterSerieFallback(
          numero_serie,
          useTrifasico,
          activeObis,
          cleanCfg
        ),
      };
      const retry = await supabase.from('meters').insert(fallback);
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    return;
  }

  const db = loadDemoDb();
  const fullLocal = {
    ...basePayload,
    es_trifasico: useTrifasico,
    codigos_obis: activeObis,
    config_tarifaria: cleanCfg,
  };
  if (id) {
    db.meters = db.meters.map((m) => (m.id === id ? { ...m, ...fullLocal } : m));
  } else {
    db.meters.push({ id: uid('meter'), ...fullLocal, created_at: new Date().toISOString() });
  }
  saveDemoDb(db, true);
}

export async function deleteMeterAdmin(meterId) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('meters').delete().eq('id', meterId);
    if (error) throw new Error(error.message);
    return;
  }
  const db = loadDemoDb();
  db.meters = db.meters.filter((m) => m.id !== meterId);
  db.readings = db.readings.filter((r) => r.meter_id !== meterId);
  db.alerts = db.alerts.filter((a) => a.meter_id !== meterId);
  saveDemoDb(db, true);
}

/**
 * 7. SYSADMIN — CRUD DE USUARIOS
 */
export async function saveUserAdmin({
  id = null,
  dni,
  nombre_completo,
  rol = 'operario',
  sede_id = null,
  activo = true,
}) {
  const cleanDni = sanitizeDni(dni);
  if (!cleanDni || cleanDni.length < 4) {
    throw new Error('Ingresa un DNI válido (mínimo 4 caracteres).');
  }
  if (!nombre_completo?.trim()) {
    throw new Error('El nombre completo es obligatorio.');
  }
  if (rol === 'operario' && !sede_id) {
    throw new Error('Debes asignar una sede al usuario operario.');
  }

  const payload = {
    dni: cleanDni,
    nombre_completo: nombre_completo.trim(),
    rol,
    sede_id: rol === 'sysadmin' ? sede_id || null : sede_id,
    activo,
  };

  if (isSupabaseConfigured) {
    if (id) {
      const { error } = await supabase.from('users_app').update(payload).eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await supabase.from('users_app').insert(payload);
    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        throw new Error('Ya existe un usuario registrado con ese DNI.');
      }
      throw new Error(error.message);
    }
    return;
  }

  const db = loadDemoDb();
  const duplicate = db.users.find((u) => u.dni === cleanDni && u.id !== id);
  if (duplicate) {
    throw new Error('Ya existe otro usuario registrado con ese DNI.');
  }

  if (id) {
    db.users = db.users.map((u) => (u.id === id ? { ...u, ...payload } : u));
  } else {
    db.users.unshift({
      id: uid('user'),
      ...payload,
      created_at: new Date().toISOString(),
    });
  }
  saveDemoDb(db, true);
}

export async function deleteUserAdmin(targetUserId, currentUserId) {
  if (targetUserId === currentUserId) {
    throw new Error('No puedes eliminar tu propio usuario administrador en sesión.');
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('users_app').delete().eq('id', targetUserId);
    if (error) throw new Error(error.message);
    return;
  }

  const db = loadDemoDb();
  db.users = db.users.filter((u) => u.id !== targetUserId);
  saveDemoDb(db, true);
}

/**
 * 8. SUSCRIPCIÓN EN TIEMPO REAL
 */
export function subscribeToRealtimeChanges({ currentUser, onSync, onRemoteAlert }) {
  if (!currentUser) return () => {};

  if (isSupabaseConfigured) {
    const channel = supabase
      .channel(`hidroluz-live-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'readings' }, () => onSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sedes' }, () => onSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meters' }, () => onSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users_app' }, () => onSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, (payload) => {
        onSync();
        if (payload.eventType === 'INSERT' && payload.new) {
          const alertRow = payload.new;
          if (currentUser.rol === 'sysadmin' || alertRow.sede_id === currentUser.sede_id) {
            onRemoteAlert?.(normalizeAlertRow(alertRow));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  return subscribeDemoRealtime(() => onSync());
}
