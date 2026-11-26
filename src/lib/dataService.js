import { supabase, isSupabaseConfigured } from './supabase';
import { evaluateReadingConsumption, sanitizeDni } from './consumption';
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

  // Modo Demo Interactivo
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
 * 2. CARGA COMPLETA DE DATOS SEGÚN ROL Y SEDE
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
      .limit(600);
    let alertsQ = supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

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
    const meters = results[1].data || [];
    const readings = results[2].data || [];
    const alerts = results[3].data || [];
    const users = isSysadmin ? results[4].data || [] : [];

    // Revalidar perfil actual por si cambió su sede o estado
    let updatedUser = currentUser;
    const { data: freshProfile } = await supabase
      .from('users_app')
      .select('*, sede:sedes(*)')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (freshProfile) updatedUser = freshProfile;

    return { sedes, meters, readings, alerts, users, updatedUser };
  }

  // Modo Demo
  const db = loadDemoDb();
  const freshLocal = db.users.find((u) => u.id === currentUser.id) || currentUser;
  const updatedUser = {
    ...freshLocal,
    sede: db.sedes.find((s) => s.id === freshLocal.sede_id) || null,
  };

  const sedes = isSysadmin
    ? db.sedes
    : db.sedes.filter((s) => s.id === updatedUser.sede_id);
  const meters = isSysadmin
    ? db.meters
    : db.meters.filter((m) => m.sede_id === updatedUser.sede_id);
  const readings = (
    isSysadmin
      ? db.readings
      : db.readings.filter((r) => r.sede_id === updatedUser.sede_id)
  ).sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime());

  const alerts = (
    isSysadmin
      ? db.alerts
      : db.alerts.filter((a) => a.sede_id === updatedUser.sede_id)
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

  // Modo Demo: convertir fotos ligeras a DataURL persistente o usar ObjectURL para videos grandes
  if (!isVideo && file.size <= 3 * 1024 * 1024) {
    const dataUrl = await fileToDataUrl(file);
    return { mediaUrl: dataUrl, mediaPath: null, mediaTipo };
  }
  const blobUrl = URL.createObjectURL(file);
  return { mediaUrl: blobUrl, mediaPath: null, mediaTipo };
}

/**
 * 4. REGISTRAR LECTURA + CÁLCULO DIARIO + DISPARO AUTOMÁTICO DE ALERTA Y WEB PUSH
 */
export async function registerMeterReading({
  currentUser,
  sede,
  meter,
  valorLectura,
  fechaLectura,
  observaciones,
  file,
  previousReadings,
}) {
  if (!currentUser) throw new Error('Sesión no válida.');
  if (currentUser.rol !== 'sysadmin' && currentUser.sede_id !== sede.id) {
    throw new Error('Solo puedes registrar lecturas correspondientes a tu propia sede.');
  }

  const numVal = Number(valorLectura);
  if (Number.isNaN(numVal) || numVal < 0) {
    throw new Error('Ingresa un valor numérico válido mayor o igual a 0.');
  }

  const isoDate = fechaLectura ? new Date(fechaLectura).toISOString() : new Date().toISOString();
  const evalResult = evaluateReadingConsumption({
    valorLectura: numVal,
    fechaLectura: isoDate,
    meter,
    previousReadings,
  });

  const { mediaUrl, mediaPath, mediaTipo } = await uploadMeterMedia({
    file,
    sedeId: sede.id,
    meterId: meter.id,
  });

  const readingPayload = {
    sede_id: sede.id,
    meter_id: meter.id,
    user_id: currentUser.id,
    usuario_nombre: currentUser.nombre_completo,
    usuario_dni: currentUser.dni,
    tipo: meter.tipo,
    valor_lectura: numVal,
    lectura_anterior: evalResult.lecturaAnterior,
    dias_transcurridos: evalResult.diasTranscurridos,
    consumo_total_periodo: evalResult.consumoTotalPeriodo,
    consumo_diario: evalResult.consumoDiario,
    promedio_previo: evalResult.promedioPrevio,
    es_anomalo: evalResult.esAnomalo,
    motivo_anomalia: evalResult.motivoAnomalia,
    media_url: mediaUrl,
    media_path: mediaPath,
    media_tipo: mediaTipo,
    observaciones: observaciones?.trim() || null,
    fecha_lectura: isoDate,
  };

  let savedReading = null;
  let createdAlert = null;

  if (isSupabaseConfigured) {
    const { data: inserted, error } = await supabase
      .from('readings')
      .insert(readingPayload)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }
    savedReading = inserted;

    if (evalResult.esAnomalo && evalResult.tipoAlerta) {
      const alertTitle =
        evalResult.tipoAlerta === 'lectura_menor'
          ? `Registro anómalo (${meter.tipo.toUpperCase()}) en ${sede.nombre}`
          : `Consumo excesivo de ${meter.tipo.toUpperCase()} en ${sede.nombre}`;

      const { data: alertRow } = await supabase
        .from('alerts')
        .insert({
          sede_id: sede.id,
          meter_id: meter.id,
          reading_id: inserted.id,
          tipo_alerta: evalResult.tipoAlerta,
          severidad: evalResult.severidad,
          titulo: alertTitle,
          mensaje: evalResult.motivoAnomalia,
          resuelta: false,
        })
        .select('*')
        .single();

      createdAlert = alertRow;
    }
  } else {
    const db = loadDemoDb();
    savedReading = {
      id: uid('read'),
      ...readingPayload,
      created_at: new Date().toISOString(),
    };
    db.readings.unshift(savedReading);

    if (evalResult.esAnomalo && evalResult.tipoAlerta) {
      const alertTitle =
        evalResult.tipoAlerta === 'lectura_menor'
          ? `Registro anómalo (${meter.tipo.toUpperCase()}) en ${sede.nombre}`
          : `Consumo excesivo de ${meter.tipo.toUpperCase()} en ${sede.nombre}`;

      createdAlert = {
        id: uid('alert'),
        sede_id: sede.id,
        meter_id: meter.id,
        reading_id: savedReading.id,
        tipo_alerta: evalResult.tipoAlerta,
        severidad: evalResult.severidad,
        titulo: alertTitle,
        mensaje: evalResult.motivoAnomalia,
        resuelta: false,
        resuelta_por: null,
        resuelta_at: null,
        created_at: new Date().toISOString(),
      };
      db.alerts.unshift(createdAlert);
    }

    saveDemoDb(db, true);
  }

  // Si hubo anomalía o consumo excesivo, disparar Notificación Nativa Web Push
  if (createdAlert) {
    triggerNativeAlertNotification({
      title: `⚠️ ${createdAlert.titulo}`,
      body: createdAlert.mensaje,
      url: '/alertas',
      severity: createdAlert.severidad,
      sedeId: sede.id,
    }).catch(() => undefined);
  }

  return { reading: savedReading, alert: createdAlert, evaluation: evalResult };
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
 * 6. SYSADMIN — CRUD DE SEDES Y MEDIDORES
 */
export async function saveSedeAdmin({
  id = null,
  nombre,
  codigo,
  direccion,
  ciudad,
  activa = true,
  umbralLuz = 180,
  umbralAgua = 25,
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

    // Crear automáticamente 1 medidor de Luz y 1 medidor de Agua por defecto
    await supabase.from('meters').insert([
      {
        sede_id: createdSede.id,
        tipo: 'luz',
        nombre: 'Medidor Principal Luz',
        numero_serie: `LUZ-${cleanCode}`,
        unidad: 'kWh',
        umbral_diario_max: umbralLuz ? Number(umbralLuz) : null,
        porcentaje_alerta_promedio: 30,
        activo: true,
      },
      {
        sede_id: createdSede.id,
        tipo: 'agua',
        nombre: 'Medidor Principal Agua',
        numero_serie: `AGUA-${cleanCode}`,
        unidad: 'm3',
        umbral_diario_max: umbralAgua ? Number(umbralAgua) : null,
        porcentaje_alerta_promedio: 30,
        activo: true,
      },
    ]);

    return createdSede;
  }

  // Modo Demo
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

  if (db.sedes.some((s) => s.codigo.toUpperCase() === cleanCode)) {
    throw new Error('Ya existe una sede con ese código.');
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
      nombre: 'Medidor Principal Luz',
      numero_serie: `LUZ-${cleanCode}`,
      unidad: 'kWh',
      umbral_diario_max: umbralLuz ? Number(umbralLuz) : null,
      porcentaje_alerta_promedio: 30,
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
      porcentaje_alerta_promedio: 30,
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
  umbral_diario_max,
  porcentaje_alerta_promedio = 30,
  activo = true,
}) {
  const unidad = tipo === 'luz' ? 'kWh' : 'm3';
  const payload = {
    sede_id,
    tipo,
    nombre: nombre.trim(),
    numero_serie: numero_serie?.trim() || null,
    unidad,
    umbral_diario_max:
      umbral_diario_max !== '' && umbral_diario_max !== null && umbral_diario_max !== undefined
        ? Number(umbral_diario_max)
        : null,
    porcentaje_alerta_promedio: Number(porcentaje_alerta_promedio || 30),
    activo,
  };

  if (isSupabaseConfigured) {
    if (id) {
      const { error } = await supabase.from('meters').update(payload).eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await supabase.from('meters').insert(payload);
    if (error) throw new Error(error.message);
    return;
  }

  const db = loadDemoDb();
  if (id) {
    db.meters = db.meters.map((m) => (m.id === id ? { ...m, ...payload } : m));
  } else {
    db.meters.push({ id: uid('meter'), ...payload, created_at: new Date().toISOString() });
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
 * 7. SYSADMIN — CRUD DE USUARIOS (CON DNI Y ASIGNACIÓN DE SEDE)
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
 * 8. SUSCRIPCIÓN EN TIEMPO REAL (SUPABASE REALTIME + DEMO BROADCAST)
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
            onRemoteAlert?.(alertRow);
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
