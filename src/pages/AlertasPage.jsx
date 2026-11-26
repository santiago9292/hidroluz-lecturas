import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  Eye,
  Info,
  Send,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { markAlertResolved } from '@/lib/dataService';
import { detectPlatformInfo, triggerNativeAlertNotification } from '@/lib/pushClient';
import MediaModal from '@/components/MediaModal';

export default function AlertasPage() {
  const {
    currentUser,
    sedes,
    meters,
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

  const getSeverityStyles = (sev, resuelta) => {
    if (resuelta) {
      return {
        card: 'bg-white border-slate-200 opacity-80',
        badge: 'bg-emerald-100 text-emerald-700',
        iconBox: 'bg-slate-100 text-slate-500',
        label: 'Resuelta',
      };
    }
    const normalized = String(sev || '').toLowerCase();
    if (normalized === 'roja' || normalized === 'alta') {
      return {
        card: 'bg-rose-50/70 border-rose-300 shadow-xs',
        badge: 'bg-rose-600 text-white',
        iconBox: 'bg-rose-100 text-rose-600',
        label: 'Alerta Roja',
      };
    }
    if (normalized === 'ambar' || normalized === 'media') {
      return {
        card: 'bg-amber-50/70 border-amber-300 shadow-xs',
        badge: 'bg-amber-500 text-white',
        iconBox: 'bg-amber-100 text-amber-700',
        label: 'Alerta Ámbar',
      };
    }
    return {
      card: 'bg-sky-50/60 border-sky-200 shadow-xs',
      badge: 'bg-sky-600 text-white',
      iconBox: 'bg-sky-100 text-sky-700',
      label: 'Aviso Operativo',
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Centro de Alertas Tarifarias y Operativas
          </h2>
          <p className="text-sm text-slate-500">
            Cada alerta incluye valor medido, umbral de referencia, causa y acción sugerida (sin duplicarse por periodo).
          </p>
        </div>

        <div className="inline-flex rounded-2xl bg-white border border-slate-200 p-1 self-start shadow-2xs">
          {[
            { id: 'pendientes', label: 'Pendientes' },
            { id: 'resueltas', label: 'Resueltas' },
            { id: 'todas', label: 'Todas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Configuración Push */}
      <div className="bg-gradient-to-r from-sky-50 via-white to-indigo-50/70 border border-sky-200 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-white text-sky-600 border border-sky-200 shadow-2xs shrink-0">
            {pushState.permission === 'granted' ? (
              <BellRing className="w-6 h-6 text-emerald-600" />
            ) : (
              <Smartphone className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Alertas Nativas en Android, iOS y PC de Escritorio
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              {pushState.permission === 'granted'
                ? `Este dispositivo (${platform.name}) recibe notificaciones nativas inmediatas ante alertas rojas, ámbar o avisos.`
                : 'Activa las notificaciones Web Push en este dispositivo para recibir alertas incluso con la pantalla bloqueada.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {pushState.permission !== 'granted' && (
            <button
              onClick={handleSendTestAlert}
              disabled={testingPush}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              Activar en este dispositivo
            </button>
          )}
          <button
            onClick={handleSendTestAlert}
            disabled={testingPush}
            className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-xs flex items-center gap-2 shadow-2xs transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-sky-600" />
            {testingPush ? 'Enviando...' : 'Probar Alerta Nativa'}
          </button>
        </div>
      </div>

      {/* Listado estructurado de Alertas */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-slate-900 text-base">No hay alertas en esta vista</p>
          <p className="text-xs text-slate-500 mt-1">
            Todos los parámetros de consumo, demanda, calificación y reactiva están dentro de rango.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredAlerts.map((alert) => {
            const sede = sedes.find((s) => s.id === alert.sede_id);
            const meter = meters.find((m) => m.id === alert.meter_id);
            const linkedReading = readings.find((r) => r.id === alert.reading_id);
            const st = getSeverityStyles(alert.severidad, alert.resuelta);

            return (
              <div key={alert.id} className={`rounded-3xl p-5 border transition ${st.card}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${st.iconBox}`}>
                      {alert.severidad === 'aviso' ? (
                        <Info className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${st.badge}`}>
                          {st.label}
                        </span>
                        {alert.periodo_key && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[10px] font-bold text-slate-600">
                            Periodo {alert.periodo_key}
                          </span>
                        )}
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                          {alert.titulo}
                        </h4>
                      </div>

                      {/* Valor vs Umbral */}
                      {(alert.valor_detectado !== null && alert.valor_detectado !== undefined) && (
                        <div className="flex flex-wrap gap-2 text-xs font-mono">
                          <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-900">
                            Valor detectado: <strong>{alert.valor_detectado}</strong>
                          </span>
                          {alert.umbral_referencia !== null &&
                            alert.umbral_referencia !== undefined && (
                              <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700">
                                Umbral: <strong>{alert.umbral_referencia}</strong>
                              </span>
                            )}
                        </div>
                      )}

                      {/* Causa y Acción sugerida */}
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                        <strong>Causa:</strong> {alert.causa || alert.mensaje}
                      </p>

                      {alert.accion_sugerida && (
                        <div className="p-2.5 rounded-xl bg-white/90 border border-slate-200/90 text-xs text-slate-800 flex items-start gap-2">
                          <Wrench className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                          <span>
                            <strong>Acción sugerida:</strong> {alert.accion_sugerida}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-slate-500">
                        Sede: <strong>{sede?.nombre || 'Sede'}</strong>
                        {meter ? ` · ${meter.nombre}` : ''} ·{' '}
                        {new Date(alert.created_at).toLocaleString('es-PE')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                    {linkedReading?.media_url && (
                      <button
                        onClick={() => setViewingMediaItem(linkedReading)}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-sky-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Evidencia
                      </button>
                    )}

                    {!alert.resuelta && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolver
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
