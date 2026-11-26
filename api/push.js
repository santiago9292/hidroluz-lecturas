import * as webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function (y middleware local en Vite) para envío de
 * Notificaciones Web Push Nativas en Android, iOS 16.4+ PWA y Escritorio.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Método no permitido' }));
  }

  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:alertas@hidroluz.app';

  if (!publicKey || !privateKey) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        sent: 0,
        warning: 'Claves VAPID no configuradas en el servidor.',
      })
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData);
    } catch {
      bodyData = {};
    }
  }

  const {
    title = 'Alerta HidroLuz',
    body = 'Se detectó un consumo excesivo o registro anómalo.',
    url = '/alertas',
    tag = `hidroluz-${Date.now()}`,
    severity = 'alta',
    sedeId = null,
    directSubscription = null,
  } = bodyData || {};

  const notificationPayload = JSON.stringify({
    title,
    body,
    url,
    tag,
    severity,
  });

  let sent = 0;
  let failed = 0;

  // 1. Si se envió una suscripción directa (ej. prueba inmediata en el dispositivo actual o modo demo)
  if (directSubscription && directSubscription.endpoint && directSubscription.keys) {
    try {
      await webpush.sendNotification(directSubscription, notificationPayload);
      sent++;
    } catch {
      failed++;
    }
  }

  // 2. Si Supabase está configurado, enviar a todos los Sysadmin + Operarios de la sede afectada
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('tu-proyecto.supabase.co')
  ) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    let query = supabase.from('push_subscriptions').select('*');
    if (sedeId) {
      query = query.or(`rol.eq.sysadmin,sede_id.eq.${sedeId}`);
    }

    const { data: subs } = await query;
    if (Array.isArray(subs) && subs.length > 0) {
      await Promise.all(
        subs.map(async (sub) => {
          // Evitar duplicar si ya se envió como directSubscription
          if (directSubscription && directSubscription.endpoint === sub.endpoint) return;
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              notificationPayload
            );
            sent++;
          } catch (err) {
            failed++;
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
        })
      );
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ ok: true, sent, failed }));
}
