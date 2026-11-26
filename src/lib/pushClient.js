import { supabase, isSupabaseConfigured } from './supabase';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function detectPlatformInfo() {
  if (typeof navigator === 'undefined') return { isIOS: false, isStandalone: false, name: 'Web' };
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true;

  let name = 'Escritorio';
  if (isIOS) name = 'iOS / iPhone / iPad';
  else if (isAndroid) name = 'Android';

  return { isIOS, isAndroid, isStandalone, name };
}

export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (err) {
    console.warn('No se pudo registrar el Service Worker:', err);
    return null;
  }
}

export async function getPushSubscriptionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'denied', subscribed: false };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      supported: false,
      permission: Notification.permission,
      subscribed: false,
    };
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(sub),
    subscription: sub,
  };
}

export async function subscribeDeviceToNativeAlerts(user) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Este navegador no soporta notificaciones nativas.');
  }

  const { isIOS, isStandalone, name } = detectPlatformInfo();
  if (isIOS && !isStandalone) {
    throw new Error(
      'En iPhone/iPad primero toca "Compartir → Agregar a pantalla de inicio" y abre HidroLuz desde tu pantalla de inicio para activar alertas nativas.'
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Debes permitir las notificaciones en el navegador para recibir alertas.');
  }

  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  let sub = await reg.pushManager.getSubscription();

  if (!sub && vapidPublicKey) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  if (sub) {
    const subJson = sub.toJSON();
    try {
      localStorage.setItem('hidroluz_push_sub', JSON.stringify(subJson));
    } catch {
      // ignore
    }

    if (isSupabaseConfigured && user?.id) {
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          sede_id: user.sede_id || null,
          rol: user.rol || 'operario',
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || '',
          plataforma: name,
          user_agent: navigator.userAgent.slice(0, 250),
        },
        { onConflict: 'endpoint' }
      );
    }
  }

  return sub;
}

/**
 * Dispara alerta nativa tanto en segundo plano vía Web Push (/api/push)
 * como localmente vía Service Worker / Notification API si el permiso está activo.
 */
export async function triggerNativeAlertNotification({
  title,
  body,
  url = '/alertas',
  severity = 'alta',
  sedeId = null,
}) {
  let savedSub = null;
  try {
    const raw = localStorage.getItem('hidroluz_push_sub');
    if (raw) savedSub = JSON.parse(raw);
  } catch {
    // ignore
  }

  // 1. Intentar envío Web Push real mediante servidor (/api/push en Vercel o Vite)
  let serverSent = false;
  try {
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        url,
        severity,
        sedeId,
        directSubscription: savedSub,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sent > 0) serverSent = true;
    }
  } catch {
    // Fallback local si no hay red hacia /api/push
  }

  // 2. Respaldo nativo inmediato si el dispositivo actual tiene permiso concedido y no recibió push aún
  if (!serverSent && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          vibrate: [250, 120, 250],
          tag: `local-${Date.now()}`,
          data: { url },
        });
        return;
      }
    }
    new Notification(title, { body, icon: '/icons/icon-192.svg' });
  }
}
