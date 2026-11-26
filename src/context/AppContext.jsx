import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  fetchAllAppData,
  loginWithDni,
  subscribeToRealtimeChanges,
} from '@/lib/dataService';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  detectPlatformInfo,
  getPushSubscriptionStatus,
  registerServiceWorker,
  subscribeDeviceToNativeAlerts,
  triggerNativeAlertNotification,
} from '@/lib/pushClient';

const AppContext = createContext(null);
const SESSION_KEY = 'hidroluz_session_user_v1';

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [sedes, setSedes] = useState([]);
  const [meters, setMeters] = useState([]);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(Boolean(currentUser));
  const [lastSyncAt, setLastSyncAt] = useState(null);

  // Toast global para feedback y alertas en vivo
  const [toast, setToast] = useState(null);

  // Estado PWA & Push Nativo
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);
  const [pushState, setPushState] = useState({
    supported: false,
    permission: 'default',
    subscribed: false,
  });

  const showToast = useCallback((message, type = 'info', duration = 4500) => {
    setToast({ id: Date.now(), message, type });
    if (duration > 0) {
      setTimeout(() => {
        setToast((prev) => (prev ? null : null));
      }, duration);
    }
  }, []);

  const refreshData = useCallback(
    async (silent = false) => {
      if (!currentUser) return;
      if (!silent) setLoadingData(true);
      try {
        const result = await fetchAllAppData(currentUser);
        setSedes(result.sedes);
        setMeters(result.meters);
        setReadings(result.readings);
        setAlerts(result.alerts);
        setUsers(result.users);
        setLastSyncAt(new Date());

        if (result.updatedUser) {
          if (!result.updatedUser.activo) {
            localStorage.removeItem(SESSION_KEY);
            setCurrentUser(null);
            showToast('Tu sesión finalizó porque el usuario fue desactivado.', 'error');
            return;
          }
          // Actualizar metadatos si cambiaron
          if (
            result.updatedUser.sede_id !== currentUser.sede_id ||
            result.updatedUser.rol !== currentUser.rol ||
            result.updatedUser.nombre_completo !== currentUser.nombre_completo
          ) {
            setCurrentUser(result.updatedUser);
            localStorage.setItem(SESSION_KEY, JSON.stringify(result.updatedUser));
          }
        }
      } catch (err) {
        console.error('Error sincronizando datos:', err);
      } finally {
        if (!silent) setLoadingData(false);
      }
    },
    [currentUser, showToast]
  );

  // Registro inicial de Service Worker + captura de instalación PWA en Android y PC
  useEffect(() => {
    registerServiceWorker().then(() => {
      getPushSubscriptionStatus().then(setPushState).catch(() => undefined);
    });

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Carga de datos y suscripción Realtime al iniciar sesión
  useEffect(() => {
    if (!currentUser) {
      setSedes([]);
      setMeters([]);
      setReadings([]);
      setAlerts([]);
      setUsers([]);
      setLoadingData(false);
      return;
    }

    refreshData(false);

    const unsubscribe = subscribeToRealtimeChanges({
      currentUser,
      onSync: () => refreshData(true),
      onRemoteAlert: (alertRow) => {
        showToast(`⚠️ ${alertRow.titulo}: ${alertRow.mensaje}`, 'warning', 7000);
      },
    });

    return () => unsubscribe();
  }, [currentUser, refreshData, showToast]);

  const login = async (dni) => {
    const user = await loginWithDni(dni);
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    showToast(`Bienvenido, ${user.nombre_completo}`, 'success');
    return user;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  };

  const enableNativeAlerts = async () => {
    const sub = await subscribeDeviceToNativeAlerts(currentUser);
    const updatedStatus = await getPushSubscriptionStatus();
    setPushState(updatedStatus);
    showToast('Alertas nativas activadas en este dispositivo.', 'success');

    // Enviar notificación nativa de confirmación inmediata
    await triggerNativeAlertNotification({
      title: '🔔 Alertas HidroLuz Activadas',
      body: 'Recibirás alertas inmediatas de consumos excesivos o registros anómalos en este dispositivo.',
      url: '/alertas',
      severity: 'media',
      sedeId: currentUser?.sede_id || null,
    });
    return sub;
  };

  const promptInstallApp = async () => {
    const { isIOS, isStandalone } = detectPlatformInfo();
    if (isStandalone) {
      showToast('HidroLuz ya está instalada en tu dispositivo.', 'info');
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredInstallPrompt(null);
        showToast('Instalando HidroLuz en tu dispositivo...', 'success');
      }
      return;
    }
    if (isIOS) {
      setShowIosInstallGuide(true);
      return;
    }
    showToast(
      'Usa el icono de instalar en la barra de direcciones de tu navegador o el menú "Instalar aplicación".',
      'info'
    );
  };

  const unresolvedAlertsCount = alerts.filter((a) => !a.resuelta).length;

  return (
    <AppContext.Provider
      value={{
        mode: isSupabaseConfigured ? 'supabase' : 'demo',
        currentUser,
        sedes,
        meters,
        readings,
        alerts,
        users,
        unresolvedAlertsCount,
        loadingData,
        lastSyncAt,
        login,
        logout,
        refreshData,
        toast,
        setToast,
        showToast,
        pushState,
        enableNativeAlerts,
        deferredInstallPrompt,
        promptInstallApp,
        showIosInstallGuide,
        setShowIosInstallGuide,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
