import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  Eye,
  Send,
  Smartphone,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { markAlertResolved } from '@/lib/dataService';
import { detectPlatformInfo, triggerNativeAlertNotification } from '@/lib/pushClient';
import MediaModal from '@/components/MediaModal';

export default function AlertasPage() {
  const {
    currentUser,
    sedes,
    readings,
    alerts,
    refreshData,
    pushState,
    enableNativeAlerts,
    showToast,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState('pendientes');
  const [testingPush, setTestingPush] = useState(false);
  const [viewingMediaItem, setViewingMediaItem] = useState(null);

  const platform = detectPlatformInfo();

  const filteredAlerts = alerts.filter((a) => {
    if (statusFilter === 'pendientes') return !a.resuelta;
    if (statusFilter === 'resueltas') return a.resuelta;
    return true;
  });

  const handleResolve = async (alertId) => {
    try {
      await markAlertResolved(alertId, currentUser.id);
      await refreshData(true);
      showToast('Alerta marcada como revisada y resuelta.', 'success');
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar la alerta.', 'error');
    }
  };

  const handleSendTestAlert = async () => {
    setTestingPush(true);
    try {
      if (pushState.permission !== 'granted') {
        await enableNativeAlerts();
      } else {
        await triggerNativeAlertNotification({
          title: '🚨 Prueba de Alerta Nativa — HidroLuz',
          body: `Notificación operativa verificada en ${platform.name} para ${currentUser.nombre_completo}.`,
          url: '/alertas',
          severity: 'alta',
          sedeId: currentUser.sede_id,
        });
        showToast('Alerta nativa de prueba enviada a tu dispositivo.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Activa permisos de notificación primero.', 'error', 6500);
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Centro de Alertas y Notificaciones Nativas
          </h2>
          <p className="text-sm text-slate-400">
            Supervisión en tiempo real de consumos excesivos y registros anómalos.
          </p>
        </div>

        <div className="inline-flex rounded-2xl bg-slate-900 border border-slate-800 p-1 self-start">
          {[
            { id: 'pendientes', label: 'Pendientes' },
            { id: 'resueltas', label: 'Resueltas' },
            { id: 'todas', label: 'Todas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel de configuración de Alertas Nativas para Android, iOS y Escritorio */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
            {pushState.permission === 'granted' ? (
              <BellRing className="w-6 h-6 text-emerald-400" />
            ) : (
              <Smartphone className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-white text-base">
              Alertas Nativas en Android, iOS y PC de Escritorio
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {pushState.permission === 'granted'
                ? `Este dispositivo (${platform.name}) está suscrito a notificaciones Web Push nativas cuando se registre un exceso de consumo o lectura anómala.`
                : 'Activa las notificaciones Web Push en este equipo o teléfono para recibir alertas nativas del sistema operativo incluso con la pantalla bloqueada.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {pushState.permission !== 'granted' && (
            <button
              onClick={handleSendTestAlert}
              disabled={testingPush}
              className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              Activar en este dispositivo
            </button>
          )}
          <button
            onClick={handleSendTestAlert}
            disabled={testingPush}
            className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            {testingPush ? 'Enviando...' : 'Probar Alerta Nativa'}
          </button>
        </div>
      </div>

      {/* Lista de Alertas */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
          <p className="font-bold text-white text-base">No hay alertas en esta vista</p>
          <p className="text-xs text-slate-400 mt-1">
            Todos los consumos monitoreados se encuentran bajo control.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const sede = sedes.find((s) => s.id === alert.sede_id);
            const linkedReading = readings.find((r) => r.id === alert.reading_id);

            return (
              <div
                key={alert.id}
                className={`rounded-3xl p-5 border transition ${
                  alert.resuelta
                    ? 'bg-slate-900/50 border-slate-800/80 opacity-80'
                    : 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/10'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                        alert.resuelta
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-white text-sm sm:text-base">
                          {alert.titulo}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            alert.resuelta
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {alert.resuelta ? 'Resuelta' : `Severidad ${alert.severidad}`}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200">{alert.mensaje}</p>
                      <p className="text-xs text-slate-400 pt-1">
                        Sede: <strong>{sede?.nombre || 'Sede'}</strong> ·{' '}
                        {new Date(alert.created_at).toLocaleString('es-PE')}
                        {linkedReading && ` · Registrado por ${linkedReading.usuario_nombre}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {linkedReading?.media_url && (
                      <button
                        onClick={() => setViewingMediaItem(linkedReading)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Evidencia
                      </button>
                    )}

                    {!alert.resuelta && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Resuelta
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MediaModal item={viewingMediaItem} onClose={() => setViewingMediaItem(null)} />
    </div>
  );
}
