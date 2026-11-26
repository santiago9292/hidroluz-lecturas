import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Droplets,
  Eye,
  FileVideo,
  Gauge,
  ImagePlus,
  Info,
  Lock,
  Save,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Video,
  Zap,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { evaluateReadingConsumption } from '@/lib/consumption';
import { getActiveObisFieldsForMeter, normalizeMeterConfig } from '@/lib/obis';
import { registerMeterReading } from '@/lib/dataService';
import MediaModal from '@/components/MediaModal';

function toLocalDatetimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function RegistroPage() {
  const { currentUser, sedes, meters, readings, alerts, refreshData, showToast } = useApp();
  const isSysadmin = currentUser?.rol === 'sysadmin';

  const availableSedes = useMemo(
    () => sedes.filter((s) => s.activa || s.id === currentUser?.sede_id),
    [sedes, currentUser]
  );

  const [selectedSedeId, setSelectedSedeId] = useState(
    currentUser?.sede_id || availableSedes[0]?.id || ''
  );
  const [utilityType, setUtilityType] = useState('luz');
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [valorLectura, setValorLectura] = useState('');
  const [obisValues, setObisValues] = useState({});
  const [customDateTime, setCustomDateTime] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);

  // Confirmaciones requeridas por las validaciones pre-guardado
  const [confirmation, setConfirmation] = useState({
    motivoEnergiaMenor: '',
    topeMedidor: '',
    confirmarBajaDemandaMitad: false,
    confirmarSalto: false,
  });

  const [saving, setSaving] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [viewingMediaItem, setViewingMediaItem] = useState(null);

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const obisInputRefs = useRef([]);

  useEffect(() => {
    if (!isSysadmin && currentUser?.sede_id) {
      setSelectedSedeId(currentUser.sede_id);
    } else if (!selectedSedeId && availableSedes.length > 0) {
      setSelectedSedeId(availableSedes[0].id);
    }
  }, [isSysadmin, currentUser, availableSedes, selectedSedeId]);

  const activeSede = useMemo(
    () => availableSedes.find((s) => s.id === selectedSedeId) || null,
    [availableSedes, selectedSedeId]
  );

  const filteredMeters = useMemo(
    () =>
      meters.filter(
        (m) => m.sede_id === selectedSedeId && m.tipo === utilityType && m.activo !== false
      ),
    [meters, selectedSedeId, utilityType]
  );

  useEffect(() => {
    if (filteredMeters.length > 0) {
      if (!filteredMeters.some((m) => m.id === selectedMeterId)) {
        setSelectedMeterId(filteredMeters[0].id);
      }
    } else {
      setSelectedMeterId('');
    }
  }, [filteredMeters, selectedMeterId]);

  const activeMeter = useMemo(
    () => filteredMeters.find((m) => m.id === selectedMeterId) || null,
    [filteredMeters, selectedMeterId]
  );

  const meterCfg = useMemo(
    () => (activeMeter ? normalizeMeterConfig(activeMeter) : null),
    [activeMeter]
  );

  const isTrifasico = Boolean(activeMeter?.es_trifasico && activeMeter?.tipo === 'luz');
  const obisFields = useMemo(
    () => (isTrifasico && activeMeter ? getActiveObisFieldsForMeter(activeMeter) : []),
    [isTrifasico, activeMeter]
  );

  useEffect(() => {
    setValorLectura('');
    setObisValues({});
    setConfirmation({
      motivoEnergiaMenor: '',
      topeMedidor: '',
      confirmarBajaDemandaMitad: false,
      confirmarSalto: false,
    });
  }, [selectedMeterId, isTrifasico]);

  const meterReadingsHistory = useMemo(
    () =>
      readings
        .filter((r) => r.meter_id === selectedMeterId)
        .sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime()),
    [readings, selectedMeterId]
  );

  const lastReading = meterReadingsHistory[0] || null;
  const lastObis = lastReading?.lecturas_obis || null;

  const requiredObisFilled = useMemo(() => {
    if (!isTrifasico) return false;
    return obisFields
      .filter((f) => f.required !== false)
      .every(
        (c) =>
          obisValues[c.code] !== undefined &&
          obisValues[c.code] !== '' &&
          !Number.isNaN(Number(obisValues[c.code]))
      );
  }, [isTrifasico, obisFields, obisValues]);

  const effectiveTimestamp = useMemo(
    () => (customDateTime ? new Date(customDateTime).toISOString() : new Date().toISOString()),
    [customDateTime]
  );

  // Evaluación y validación pre-guardado en tiempo real
  const liveEval = useMemo(() => {
    if (!activeMeter) return null;
    if (isTrifasico && !requiredObisFilled) return null;
    if (!isTrifasico && (valorLectura === '' || Number.isNaN(Number(valorLectura)))) return null;

    return evaluateReadingConsumption({
      valorLectura: isTrifasico ? 0 : Number(valorLectura),
      obisValues: isTrifasico ? obisValues : null,
      fechaLectura: effectiveTimestamp,
      meter: activeMeter,
      previousReadings: meterReadingsHistory,
      hasMedia: Boolean(mediaFile),
      confirmation,
    });
  }, [
    activeMeter,
    isTrifasico,
    requiredObisFilled,
    obisValues,
    valorLectura,
    effectiveTimestamp,
    meterReadingsHistory,
    mediaFile,
    confirmation,
  ]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast('El archivo excede los 50 MB permitidos.', 'error');
      return;
    }
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleObisKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = obisInputRefs.current[idx + 1];
      if (nextInput) nextInput.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeSede || !activeMeter) {
      showToast('Selecciona una sede y medidor válidos.', 'error');
      return;
    }
    if (liveEval && !liveEval.valid) {
      showToast(
        liveEval.blockingIssues[0]?.message || 'Completa las confirmaciones requeridas.',
        'error',
        5500
      );
      return;
    }

    setSaving(true);
    try {
      const { alert, notices } = await registerMeterReading({
        currentUser,
        sede: activeSede,
        meter: activeMeter,
        valorLectura: isTrifasico ? 0 : Number(valorLectura),
        obisValues: isTrifasico ? obisValues : null,
        fechaLectura: customDateTime ? new Date(customDateTime).toISOString() : undefined,
        observaciones,
        file: mediaFile,
        previousReadings: meterReadingsHistory,
        existingAlerts: alerts,
        confirmation,
      });

      await refreshData(true);
      setValorLectura('');
      setObisValues({});
      setCustomDateTime('');
      setObservaciones('');
      setConfirmation({
        motivoEnergiaMenor: '',
        topeMedidor: '',
        confirmarBajaDemandaMitad: false,
        confirmarSalto: false,
      });
      clearMedia();

      if (alert) {
        showToast(`⚠️ Lectura guardada con alerta: ${alert.titulo}`, 'warning', 6500);
      } else if (notices?.some((n) => n.type === 'reinicio_demanda_corte')) {
        showToast('Lectura guardada: reinicio normal de demanda detectado (nuevo periodo).', 'success', 4500);
      } else {
        showToast('Lectura cruda y cálculos guardados correctamente.', 'success', 3000);
      }
    } catch (err) {
      showToast(err.message || 'Error al registrar lectura.', 'error', 5500);
    } finally {
      setSaving(false);
    }
  };

  const sedeRecentReadings = useMemo(
    () => readings.filter((r) => r.sede_id === selectedSedeId).slice(0, 8),
    [readings, selectedSedeId]
  );

  const canSubmit =
    Boolean(activeMeter) &&
    !saving &&
    (isTrifasico ? requiredObisFilled : valorLectura !== '') &&
    Boolean(liveEval?.valid);

  const renderRecentList = () => {
    if (sedeRecentReadings.length === 0) {
      return (
        <p className="text-xs sm:text-sm text-slate-400 py-6 text-center">
          Aún no hay lecturas registradas en esta sede.
        </p>
      );
    }

    return (
      <div className="space-y-2.5">
        {sedeRecentReadings.map((item) => {
          const isLuz = item.tipo === 'luz';
          const unit = isLuz ? 'kWh' : 'm³';
          const obisEntries = item.lecturas_obis ? Object.entries(item.lecturas_obis) : [];
          const calc = item.calculos || null;

          return (
            <div
              key={item.id}
              className={`p-3 rounded-2xl border transition ${
                item.es_anomalo
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-slate-50/80 border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1.5 rounded-xl shrink-0 ${
                      isLuz ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {isLuz ? <Zap className="w-4 h-4" /> : <Droplets className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        Δ {calc?.consumoTotal ?? item.consumo_total_periodo} {unit}
                      </span>
                      {obisEntries.length === 0 && (
                        <span className="text-[11px] font-mono text-slate-500">
                          (Crudo: {item.valor_crudo ?? item.valor_lectura})
                        </span>
                      )}
                      {item.evento_lectura && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          {item.evento_lectura.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {new Date(item.fecha_lectura).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {item.usuario_nombre.split(' ')[0]}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-700">
                    <TrendingUp className="w-3 h-3" />
                    {calc?.promedioDiario ?? item.consumo_diario} {unit}/d
                  </span>
                  {item.media_url && (
                    <button
                      type="button"
                      onClick={() => setViewingMediaItem(item)}
                      className="mt-1 flex items-center gap-1 ml-auto px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-sky-700 cursor-pointer"
                    >
                      {item.media_tipo === 'video' ? (
                        <FileVideo className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      Ver
                    </button>
                  )}
                </div>
              </div>

              {obisEntries.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {obisEntries.map(([code, val]) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono text-slate-700"
                    >
                      <strong>{code}:</strong> {val}
                    </span>
                  ))}
                </div>
              )}

              {item.motivo_anomalia && (
                <p className="mt-1.5 text-[11px] font-medium text-rose-700 bg-rose-100/70 px-2.5 py-1 rounded-xl">
                  {item.motivo_anomalia}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* CABECERA COMPACTA PARA TELÉFONO */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            Registrar Lectura
          </h2>
          <p className="hidden sm:block text-sm text-slate-500">
            Guarda el valor crudo exacto del medidor; el sistema aplica factores, cortes y alertas.
          </p>
        </div>

        <div className="shrink-0 max-w-[56%] sm:w-72">
          {isSysadmin ? (
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedSedeId}
                onChange={(e) => setSelectedSedeId(e.target.value)}
                className="w-full pl-8 pr-6 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white border border-slate-300 shadow-2xs text-xs sm:text-sm font-bold text-slate-900 focus:border-sky-500 outline-none truncate"
              >
                {availableSedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {activeSede?.nombre || 'Mi Sede'}
              </span>
              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* FORMULARIO COMPACTO DE REGISTRO */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 shadow-xs"
        >
          {/* Selector Luz vs Agua */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setUtilityType('luz')}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                utilityType === 'luz'
                  ? 'bg-white text-amber-700 shadow-xs border border-amber-300/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap
                className={`w-4 h-4 shrink-0 ${
                  utilityType === 'luz' ? 'text-amber-500 fill-amber-400/30' : 'text-slate-400'
                }`}
              />
              <span className="truncate">Luz (kWh)</span>
            </button>

            <button
              type="button"
              onClick={() => setUtilityType('agua')}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                utilityType === 'agua'
                  ? 'bg-white text-sky-700 shadow-xs border border-sky-300/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Droplets
                className={`w-4 h-4 shrink-0 ${
                  utilityType === 'agua' ? 'text-sky-600 fill-sky-400/30' : 'text-slate-400'
                }`}
              />
              <span className="truncate">Agua (m³)</span>
            </button>
          </div>

          {filteredMeters.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {filteredMeters.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMeterId(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                    m.id === selectedMeterId
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m.nombre} {m.es_trifasico ? '(3F)' : ''}
                </button>
              ))}
            </div>
          )}

          {/* Barra informativa de medidor, tarifa, factor y corte */}
          {activeMeter && meterCfg ? (
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeMeter.tipo === 'luz' && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                    {meterCfg.tarifa}
                  </span>
                )}
                {isTrifasico && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${
                      meterCfg.hp_registro === 'sin_asignar'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    <Cpu className="w-3 h-3" />
                    {meterCfg.hp_registro === 'sin_asignar'
                      ? 'HP/HFP sin asignar'
                      : `HP=${meterCfg.hp_registro}`}
                  </span>
                )}
                <span className="font-semibold text-slate-700 truncate">{activeMeter.nombre}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-500 font-mono">
                {activeMeter.tipo === 'luz' &&
                  (meterCfg.factor_energia !== 1 || meterCfg.factor_demanda !== 1) && (
                    <span>
                      FE:×{meterCfg.factor_energia} FD:×{meterCfg.factor_demanda}
                    </span>
                  )}
                <span>Corte: D{meterCfg.dia_corte}</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
              No hay medidor activo de {utilityType} en esta sede.
            </div>
          )}

          {/* CAMPOS CRUDOS DEL MEDIDOR */}
          {activeMeter && isTrifasico ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Valores Crudos en Pantalla del Medidor
                </label>
                {lastObis && (
                  <span className="text-[10px] text-slate-400">
                    Toca &ldquo;Ant&rdquo; si un registro no cambió
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {obisFields.map((cfgField, idx) => {
                  const prevVal =
                    lastObis && lastObis[cfgField.code] !== undefined
                      ? lastObis[cfgField.code]
                      : null;
                  const isEnergy = cfgField.sumaConsumo;

                  return (
                    <div
                      key={cfgField.code}
                      className={`p-2.5 rounded-2xl border transition ${
                        isEnergy
                          ? 'bg-amber-50/35 border-amber-200/90 focus-within:border-amber-500 focus-within:bg-white'
                          : cfgField.role === 'reactiva'
                          ? 'bg-purple-50/35 border-purple-200 focus-within:border-purple-500 focus-within:bg-white'
                          : 'bg-slate-50/80 border-slate-200 focus-within:border-sky-500 focus-within:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-mono font-extrabold text-xs text-slate-900">
                          {cfgField.code}
                          {cfgField.required === false ? ' (opc)' : ''}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            isEnergy
                              ? 'bg-amber-100 text-amber-800'
                              : cfgField.role === 'reactiva'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {cfgField.unit}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] text-slate-500 truncate">{cfgField.label}</span>
                        {prevVal !== null && (
                          <button
                            type="button"
                            onClick={() =>
                              setObisValues((prev) => ({
                                ...prev,
                                [cfgField.code]: String(prevVal),
                              }))
                            }
                            className="text-[10px] font-mono font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-1.5 py-0.2 rounded cursor-pointer shrink-0"
                          >
                            Ant: {prevVal}
                          </button>
                        )}
                      </div>

                      <input
                        ref={(el) => {
                          obisInputRefs.current[idx] = el;
                        }}
                        type="number"
                        step="0.0001"
                        min="0"
                        inputMode="decimal"
                        enterKeyHint={idx < obisFields.length - 1 ? 'next' : 'done'}
                        onKeyDown={(e) => handleObisKeyDown(e, idx)}
                        placeholder={prevVal !== null ? `${prevVal}` : '0'}
                        value={obisValues[cfgField.code] ?? ''}
                        onChange={(e) =>
                          setObisValues((prev) => ({
                            ...prev,
                            [cfgField.code]: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-300 focus:border-sky-500 outline-none text-base sm:text-lg font-mono font-extrabold text-slate-900 placeholder:text-slate-300"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            activeMeter && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Valor Crudo del Medidor ({activeMeter.unidad})
                  </label>
                  {lastReading && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Anterior: <strong>{lastReading.valor_crudo ?? lastReading.valor_lectura}</strong>{' '}
                      {activeMeter.unidad}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Gauge className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder={
                      lastReading
                        ? `Anterior: ${lastReading.valor_crudo ?? lastReading.valor_lectura}`
                        : 'Ej. 14520.50'
                    }
                    value={valorLectura}
                    onChange={(e) => setValorLectura(e.target.value)}
                    className="w-full pl-11 pr-16 py-3 rounded-2xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 outline-none text-lg sm:text-xl font-mono font-extrabold text-slate-900 placeholder:text-slate-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-slate-200/80 text-xs font-mono font-bold text-slate-700">
                    {activeMeter.unidad}
                  </span>
                </div>
              </div>
            )
          )}

          {/* CÁLCULO EN VIVO + AVISOS DE CORTE + BLOQUEOS/CONFIRMACIONES PRE-GUARDADO */}
          {liveEval && activeMeter && (
            <div className="space-y-2.5">
              {liveEval.step && (
                <div
                  className={`rounded-2xl p-3 border ${
                    liveEval.triggeredAlerts?.some((a) => a.severidad === 'roja')
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : liveEval.triggeredAlerts?.some((a) => a.severidad === 'ambar')
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Consumo Tramo: {liveEval.consumoTotalPeriodo} {activeMeter.unidad}
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-extrabold px-2 py-0.5 rounded-lg bg-white border border-black/10">
                      {liveEval.consumoDiario} {activeMeter.unidad}/día
                    </span>
                  </div>

                  {isTrifasico && (
                    <p className="text-[11px] mt-1 font-mono opacity-90">
                      {liveEval.consumoHP !== null
                        ? `HP: ${liveEval.consumoHP} kWh · HFP: ${liveEval.consumoHFP} kWh`
                        : `ΔT1: ${liveEval.step.consumoT1} · ΔT2: ${liveEval.step.consumoT2} (HP sin asignar)`}
                      {liveEval.demandaMaxLectura !== null &&
                        ` · Dem. Máx: ${liveEval.demandaMaxLectura} kW`}
                      {liveEval.consumoReactiva !== null &&
                        ` · Reactiva: ${liveEval.consumoReactiva} kVARh`}
                    </p>
                  )}

                  {liveEval.horasTranscurridas !== null && (
                    <p className="text-[10px] opacity-75 mt-0.5">
                      Intervalo exacto: {liveEval.horasTranscurridas} h (promedio 24 h)
                    </p>
                  )}
                </div>
              )}

              {/* Avisos informativos (ej. reinicio normal de demanda cerca del corte) */}
              {liveEval.notices?.map((n, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2"
                >
                  <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <span>{n.message}</span>
                </div>
              ))}

              {/* VALIDACIONES BLOQUEANTES QUE EXIGEN CONFIRMACIÓN ANTES DE GUARDAR */}
              {liveEval.blockingIssues?.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-2.5"
                >
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-extrabold text-rose-900">{issue.title}</p>
                      <p className="text-xs text-rose-800 mt-0.5 leading-snug">{issue.message}</p>
                    </div>
                  </div>

                  {issue.type === 'energia_menor' && (
                    <div className="bg-white p-2.5 rounded-xl border border-rose-200 space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Si NO es un error de digitación, selecciona la causa verificada:
                      </label>
                      <select
                        value={confirmation.motivoEnergiaMenor}
                        onChange={(e) =>
                          setConfirmation((prev) => ({
                            ...prev,
                            motivoEnergiaMenor: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900"
                      >
                        <option value="">— Fue error de digitación (voy a corregir el número) —</option>
                        <option value="cambio_medidor">
                          Cambio de medidor físico (iniciar nueva base en este valor)
                        </option>
                        <option value="vuelta_cero">
                          Vuelta a cero del contador del medidor
                        </option>
                      </select>

                      {confirmation.motivoEnergiaMenor === 'vuelta_cero' && (
                        <input
                          type="number"
                          placeholder="Tope del medidor si aplica (ej. 10000 o 100000; 0 si reinició)"
                          value={confirmation.topeMedidor}
                          onChange={(e) =>
                            setConfirmation((prev) => ({ ...prev, topeMedidor: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 font-mono text-xs"
                        />
                      )}
                    </div>
                  )}

                  {issue.type === 'demanda_baja_mitad_periodo' && (
                    <label className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-rose-200 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmation.confirmarBajaDemandaMitad}
                        onChange={(e) =>
                          setConfirmation((prev) => ({
                            ...prev,
                            confirmarBajaDemandaMitad: e.target.checked,
                          }))
                        }
                      />
                      He revisado la pantalla del medidor y confirmo que la demanda disminuyó
                    </label>
                  )}

                  {issue.type === 'salto_extremo_confirmacion' && (
                    <div className="bg-white p-2.5 rounded-xl border border-rose-200 space-y-1.5">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmation.confirmarSalto}
                          onChange={(e) =>
                            setConfirmation((prev) => ({
                              ...prev,
                              confirmarSalto: e.target.checked,
                            }))
                          }
                        />
                        Confirmo que todos los dígitos ingresados son exactos
                      </label>
                      {!mediaFile && (
                        <p className="text-[11px] font-bold text-rose-600">
                          📷 Además debes adjuntar foto obligatoria del medidor abajo para desbloquear.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Previsualización de alertas que se registrarán */}
              {liveEval.valid &&
                liveEval.triggeredAlerts?.map((al, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                      al.severidad === 'roja'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : al.severidad === 'ambar'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>[{al.severidad.toUpperCase()}] {al.titulo}:</strong> {al.causa}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* EVIDENCIA FOTO / VIDEO */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Evidencia (Foto o Video)
            </label>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {!mediaFile ? (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-sky-50 border border-dashed border-slate-300 hover:border-sky-400 text-slate-700 transition cursor-pointer"
                >
                  <Camera className="w-4.5 h-4.5 text-sky-600 shrink-0" />
                  <span className="text-xs font-bold">Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-dashed border-slate-300 hover:border-indigo-400 text-slate-700 transition cursor-pointer"
                >
                  <Video className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold">Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-dashed border-slate-300 hover:border-emerald-400 text-slate-700 transition cursor-pointer"
                >
                  <ImagePlus className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold">Galería</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden">
                <div className="relative max-h-44 bg-slate-900 flex items-center justify-center">
                  {mediaFile.type.startsWith('video/') ? (
                    <video
                      src={mediaPreviewUrl}
                      controls
                      className="max-h-44 w-full object-contain"
                    />
                  ) : (
                    <img
                      src={mediaPreviewUrl}
                      alt="Vista previa"
                      className="max-h-44 w-full object-contain"
                    />
                  )}
                </div>
                <div className="px-3 py-2 flex items-center justify-between gap-2 bg-white border-t border-slate-200">
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {mediaFile.name} ({(mediaFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fecha/hora opcional y observación */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Observación opcional..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="sm:col-span-7 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 outline-none text-xs sm:text-sm text-slate-900 placeholder:text-slate-400"
            />
            <input
              type="datetime-local"
              value={customDateTime}
              max={toLocalDatetimeInputValue(new Date())}
              onChange={(e) => setCustomDateTime(e.target.value)}
              title="Hora exacta de toma (vacío = ahora mismo)"
              className="sm:col-span-5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 transition cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Validando y guardando...' : 'Guardar Lectura'}</span>
          </button>
        </form>

        {/* HISTORIAL RECIENTE */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-xs">
          <button
            type="button"
            onClick={() => setShowMobileHistory((v) => !v)}
            className="w-full lg:pointer-events-none flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-sky-600" />
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Últimos Registros ({sedeRecentReadings.length})
              </h3>
            </div>
            <span className="lg:hidden inline-flex items-center gap-1 text-xs font-semibold text-sky-700">
              {showMobileHistory ? (
                <>
                  Ocultar <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Ver historial <ChevronDown className="w-4 h-4" />
                </>
              )}
            </span>
          </button>

          <div className={`${showMobileHistory ? 'block mt-3.5' : 'hidden'} lg:block lg:mt-4`}>
            {renderRecentList()}
          </div>
        </div>
      </div>

      <MediaModal item={viewingMediaItem} onClose={() => setViewingMediaItem(null)} />
    </div>
  );
}
