import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  Building2,
  ClipboardPlus,
  Download,
  Droplets,
  GitCompareArrows,
  LogOut,
  Radio,
  Share,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { detectPlatformInfo } from '@/lib/pushClient';

export default function AppShell({ children }) {
  const {
    mode,
    currentUser,
    sedes,
    unresolvedAlertsCount,
    logout,
    pushState,
    enableNativeAlerts,
    deferredInstallPrompt,
    promptInstallApp,
    showIosInstallGuide,
    setShowIosInstallGuide,
    toast,
    setToast,
    showToast,
  } = useApp();

  const navigate = useNavigate();
  const isSysadmin = currentUser?.rol === 'sysadmin';
  const assignedSede = sedes.find((s) => s.id === currentUser?.sede_id);
  const platform = detectPlatformInfo();

  const navItems = [
    {
      to: '/registro',
      label: 'Registro',
      icon: ClipboardPlus,
      show: true,
    },
    {
      to: '/graficos',
      label: 'Gráficos Sede',
      icon: BarChart3,
      show: true,
    },
    {
      to: '/comparativa',
      label: 'Comparar Sedes',
      icon: GitCompareArrows,
      show: isSysadmin,
    },
    {
      to: '/alertas',
      label: 'Alertas',
      icon: AlertTriangle,
      badge: unresolvedAlertsCount,
      show: true,
    },
    {
      to: '/admin',
      label: 'Sysadmin',
      icon: ShieldCheck,
      show: isSysadmin,
    },
  ].filter((item) => item.show);

  const handleEnablePush = async () => {
    try {
      await enableNativeAlerts();
    } catch (err) {
      showToast(err.message || 'No se pudieron activar las alertas.', 'error', 6500);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* SIDEBAR ESCRITORIO */}
      <aside className="hidden lg:flex lg:w-68 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 shadow-xs z-30">
        <div className="p-5 flex items-center gap-3 border-b border-slate-100">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-50 via-sky-50 to-white border border-slate-200 flex items-center justify-center shadow-xs">
            <div className="flex items-center -space-x-1">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-400/30" />
              <Droplets className="w-5 h-5 text-sky-600 fill-sky-400/30" />
            </div>
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-slate-900">
              HidroLuz Control
            </h1>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>{mode === 'supabase' ? 'Supabase Realtime' : 'Tiempo Real (Demo)'}</span>
            </div>
          </div>
        </div>

        {/* Tarjeta de usuario en sesión */}
        <div className="p-4 mx-3 mt-4 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
              {isSysadmin ? 'Sysadmin Global' : 'Operario Sede'}
            </span>
            <span className="text-xs font-mono font-medium text-slate-500">
              DNI {currentUser?.dni}
            </span>
          </div>
          <p className="mt-2 font-bold text-sm text-slate-900 truncate">
            {currentUser?.nombre_completo}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5 truncate">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {isSysadmin
              ? `Acceso total (${sedes.length} sedes)`
              : assignedSede?.nombre || 'Sede asignada'}
          </p>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-200/90 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4.5 h-4.5" />
                  {item.label}
                </span>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-600 text-white shadow-xs">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Acciones rápidas PWA + Alertas Nativas + Salir */}
        <div className="p-3 border-t border-slate-200 space-y-2">
          {pushState.permission !== 'granted' ? (
            <button
              onClick={handleEnablePush}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition cursor-pointer"
            >
              <Bell className="w-4 h-4 text-amber-600" />
              Activar Alertas Nativas
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <BellRing className="w-3.5 h-3.5" />
              Alertas Nativas Activas
            </div>
          )}

          {!platform.isStandalone && (
            <button
              onClick={promptInstallApp}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              Instalar App ({platform.name})
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* CABECERA MÓVIL Y TABLET */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-amber-500" />
            <Droplets className="w-4 h-4 text-sky-600 -ml-1" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-900 leading-tight truncate">HidroLuz</p>
            <p className="text-[11px] text-slate-500 truncate">
              {isSysadmin ? 'Sysadmin' : assignedSede?.nombre || currentUser?.nombre_completo}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {pushState.permission !== 'granted' && (
            <button
              onClick={handleEnablePush}
              title="Activar alertas nativas"
              className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200"
            >
              <Bell className="w-4 h-4" />
            </button>
          )}

          {!platform.isStandalone && (deferredInstallPrompt || platform.isIOS) && (
            <button
              onClick={promptInstallApp}
              title="Instalar aplicación"
              className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 lg:pl-68 pb-24 lg:pb-10">
        {mode === 'demo' && (
          <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>
                <strong>Modo Demo Interactivo:</strong> Configura{' '}
                <code className="px-1 py-0.5 rounded bg-white border border-indigo-200 text-indigo-700">
                  VITE_SUPABASE_URL
                </code>{' '}
                y{' '}
                <code className="px-1 py-0.5 rounded bg-white border border-indigo-200 text-indigo-700">
                  VITE_SUPABASE_ANON_KEY
                </code>{' '}
                para conectar tu base de datos en Supabase.
              </span>
            </span>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR EN MÓVIL */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around safe-area-bottom shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition ${
                  isActive ? 'text-sky-700 bg-sky-50' : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate max-w-[68px]">{item.label.split(' ')[0]}</span>
              {item.badge > 0 && (
                <span className="absolute top-1 right-2 h-4 min-w-4 px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* TOAST FLOTANTE DE NOTIFICACIONES EN VIVO */}
      {toast && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in fade-in slide-in-from-top-2">
          <div
            className={`rounded-2xl p-4 shadow-xl border flex items-start justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : toast.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <p className="text-sm leading-snug font-semibold">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* GUÍA INTERACTIVA DE INSTALACIÓN NATIVA PARA iOS (iPhone / iPad) */}
      {showIosInstallGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Instalar en iPhone / iPad</h3>
              <button
                onClick={() => setShowIosInstallGuide(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Para instalar <strong>HidroLuz</strong> como aplicación nativa en iOS y recibir{' '}
              <strong>alertas Push nativas</strong>:
            </p>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <Share className="w-5 h-5 text-sky-600 shrink-0" />
                <span>
                  1. Toca el botón <strong>Compartir</strong> en la barra de Safari.
                </span>
              </li>
              <li className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <Download className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  2. Selecciona <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong>.
                </span>
              </li>
              <li className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <BellRing className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  3. Abre la app desde tu inicio y pulsa <strong>Activar Alertas Nativas</strong>.
                </span>
              </li>
            </ol>
            <button
              onClick={() => setShowIosInstallGuide(false)}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
