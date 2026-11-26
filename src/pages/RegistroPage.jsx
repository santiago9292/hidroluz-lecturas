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
  Lock,
  Save,
  Trash2,
  TrendingUp,
  Video,
  Zap,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { evaluateReadingConsumption } from '@/lib/consumption';
import { DEFAULT_TRIFASICO_CODES } from '@/lib/obis';
import { registerMeterReading } from '@/lib/dataService';
import MediaModal from '@/components/MediaModal';

export default function RegistroPage() {
  const { currentUser, sedes, meters, readings, refreshData, showToast } = useApp();
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
  const [observaciones, setObservaciones] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
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

  const isTrifasico = Boolean(activeMeter?.es_trifasico && activeMeter?.tipo === 'luz');
  const obisConfig = useMemo(
    () =>
      isTrifasico
        ? activeMeter?.codigos_obis || DEFAULT_TRIFASICO_CODES
        : [],
    [isTrifasico, activeMeter]
  );

  // Reiniciar campos al cambiar de medidor
  useEffect(() => {
    setValorLectura('');
    setObisValues({});
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

  const allObisFilled = useMemo(() => {
    if (!isTrifasico) return false;
    return obisConfig.every(
      (c) =>
        obisValues[c.code] !== undefined &&
        obisValues[c.code] !== '' &&
        !Number.isNaN(Number(obisValues[c.code]))
    );
  }, [isTrifasico, obisConfig, obisValues]);

  // Evaluación instantánea en vivo (tanto Monofásico como Trifásico OBIS)
  const liveEval = useMemo(() => {
    if (!activeMeter) return null;

    if (isTrifasico) {
      const anyEnergyEntered = obisConfig.some(
        (c) => c.sumaConsumo !== false && obisValues[c.code] !== undefined && obisValues[c.code] !== ''
      );
      if (!anyEnergyEntered) return null;
      return evaluateReadingConsumption({
        valorLectura: 0,
        obisValues,
        fechaLectura: new Date().toISOString(),
        meter: activeMeter,
        previousReadings: meterReadingsHistory,
      });
    }

    if (valorLectura === '' || Number.isNaN(Number(valorLectura))) {
      return null;
    }
    return evaluateReadingConsumption({
      valorLectura: Number(valorLectura),
      fechaLectura: new Date().toISOString(),
      meter: activeMeter,
      previousReadings: meterReadingsHistory,
    });
  }, [activeMeter, isTrifasico, obisConfig, obisValues, valorLectura, meterReadingsHistory]);

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
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeSede || !activeMeter) {
      showToast('Selecciona una sede y medidor válidos.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { alert } = await registerMeterReading({
        currentUser,
        sede: activeSede,
        meter: activeMeter,
        valorLectura: isTrifasico ? 0 : Number(valorLectura),
        obisValues: isTrifasico ? obisValues : null,
        observaciones,
        file: mediaFile,
        previousReadings: meterReadingsHistory,
      });

      await refreshData(true);
      setValorLectura('');
      setObisValues({});
      setObservaciones('');
      clearMedia();

      if (alert) {
        showToast(`⚠️ Lectura guardada con ALERTA: ${alert.mensaje}`, 'warning', 6500);
      } else {
        showToast('Lectura guardada correctamente.', 'success', 3000);
      }
    } catch (err) {
      showToast(err.message || 'Error al registrar lectura.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sedeRecentReadings = useMemo(
    () => readings.filter((r) => r.sede_id === selectedSedeId).slice(0, 8),
    [readings, selectedSedeId]
  );

  const canSubmit =
    Boolean(activeMeter) && !saving && (isTrifasico ? allObisFilled : valorLectura !== '');

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
                        {item.valor_lectura} {unit}
                      </span>
                      {obisEntries.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          3F
                        </span>
                      )}
                      {item.es_anomalo && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                          ALERTA
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
                    {item.consumo_diario} {unit}/d
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
      {/* CABECERA COMPACTA EN UNA SOLA FILA PARA MÓVIL */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
            Registrar Lectura
          </h2>
          <p className="hidden sm:block text-sm text-slate-500">
            Ingresa los valores actuales del medidor y adjunta evidencia fotográfica o en video.
          </p>
        </div>

        {/* Sede compacta */}
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
        {/* FORMULARIO OPTIMIZADO PARA UNA MANO EN MÓVIL */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-3.5 sm:space-y-5 shadow-xs"
        >
          {/* 1. Selector segmentado Luz vs Agua (1 sola fila compacta) */}
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

          {/* Selector de medidor si hay varios del mismo tipo en la sede */}
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

          {/* Franja compacta de estado del medidor activo */}
          {activeMeter ? (
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                {isTrifasico ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[11px]">
                    <Cpu className="w-3 h-3" /> Trifásico ({obisConfig.length} cód.)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-semibold text-[11px]">
                    {activeMeter.tipo === 'luz' ? 'Monofásico' : ' Agua'}
                  </span>
                )}
                <span className="font-semibold text-slate-700 truncate">{activeMeter.nombre}</span>
              </div>

              <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-mono">
                {!isTrifasico && (
                  <span>
                    Ant:{' '}
                    <strong className="text-slate-800">
                      {lastReading ? `${lastReading.valor_lectura}` : '—'}
                    </strong>
                  </span>
                )}
                {activeMeter.umbral_diario_max && (
                  <span>
                    Máx:{' '}
                    <strong className="text-slate-800">
                      {activeMeter.umbral_diario_max} {activeMeter.unidad}/d
                    </strong>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
              No hay medidor activo de {utilityType} en esta sede. Configúralo en Sysadmin.
            </div>
          )}

          {/* 2. LECTURAS DEL MEDIDOR: CUADRÍCULA 2x2 TRIFÁSICA O CAMPO MONOFÁSICO */}
          {activeMeter && isTrifasico ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Lecturas por Código OBIS
                </label>
                {lastObis && (
                  <span className="text-[10px] text-slate-400">
                    Toca &ldquo;Ant&rdquo; si el código no varió
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {obisConfig.map((cfg, idx) => {
                  const prevVal =
                    lastObis && lastObis[cfg.code] !== undefined ? lastObis[cfg.code] : null;
                  const isEnergy = cfg.sumaConsumo !== false;

                  return (
                    <div
                      key={cfg.code}
                      className={`p-2.5 rounded-2xl border transition ${
                        isEnergy
                          ? 'bg-amber-50/35 border-amber-200/90 focus-within:border-amber-500 focus-within:bg-white'
                          : 'bg-slate-50/80 border-slate-200 focus-within:border-sky-500 focus-within:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono font-extrabold text-xs text-slate-900">
                          Cód. {cfg.code}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            isEnergy
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isEnergy ? 'kWh' : 'Dem.'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] text-slate-500 truncate">{cfg.label}</span>
                        {prevVal !== null && (
                          <button
                            type="button"
                            onClick={() =>
                              setObisValues((prev) => ({ ...prev, [cfg.code]: String(prevVal) }))
                            }
                            className="text-[10px] font-mono font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-1.5 py-0.2 rounded cursor-pointer shrink-0"
                            title="Copiar lectura anterior"
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
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        enterKeyHint={idx < obisConfig.length - 1 ? 'next' : 'done'}
                        onKeyDown={(e) => handleObisKeyDown(e, idx)}
                        placeholder={prevVal !== null ? `${prevVal}` : '0'}
                        value={obisValues[cfg.code] ?? ''}
                        onChange={(e) =>
                          setObisValues((prev) => ({
                            ...prev,
                            [cfg.code]: e.target.value,
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
                    Lectura Actual ({activeMeter.unidad})
                  </label>
                  {lastReading && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Anterior: <strong>{lastReading.valor_lectura}</strong> {activeMeter.unidad}
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
                        ? `Mayor o igual a ${lastReading.valor_lectura}`
                        : 'Ej. 14520.50'
                    }
                    value={valorLectura}
                    onChange={(e) => setValorLectura(e.target.value)}
                    className="w-full pl-11 pr-16 py-3 rounded-2xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 focus:ring-3 focus:ring-sky-500/15 outline-none text-lg sm:text-xl font-mono font-extrabold text-slate-900 placeholder:text-slate-400 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-slate-200/80 text-xs font-mono font-bold text-slate-700">
                    {activeMeter.unidad}
                  </span>
                </div>
              </div>
            )
          )}

          {/* SEMÁFORO COMPACTO DE CONSUMO DIARIO EN VIVO */}
          {liveEval && activeMeter && (
            <div
              className={`rounded-2xl p-3 border transition ${
                liveEval.esAnomalo
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {liveEval.esAnomalo ? (
                  <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs sm:text-sm truncate">
                      {liveEval.esAnomalo ? 'Alerta detectada' : 'Consumo diario estimado'}
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-extrabold px-2 py-0.5 rounded-lg bg-white/90 border border-black/10 shrink-0">
                      {liveEval.consumoDiario} {activeMeter.unidad}/día
                    </span>
                  </div>
                  <p className="text-[11px] opacity-85 mt-0.5">
                    {isTrifasico && `Energía acum. (1.8.1+1.8.2): ${liveEval.valorCalculado} kWh · `}
                    Δ {liveEval.consumoTotalPeriodo} {activeMeter.unidad} en{' '}
                    {liveEval.diasTranscurridos}d
                  </p>
                  {liveEval.motivoAnomalia && (
                    <p className="text-[11px] font-semibold text-rose-800 mt-1 leading-snug">
                      {liveEval.motivoAnomalia}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. EVIDENCIA FOTO / VIDEO COMPACTA */}
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

          {/* 4. OBSERVACIÓN COMPACTA EN 1 LÍNEA */}
          <input
            type="text"
            placeholder="Observación opcional (ej. sin novedad, cambio de turno...)"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 outline-none text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition"
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 transition cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Guardando lectura...' : 'Guardar Lectura'}</span>
          </button>
        </form>

        {/* HISTORIAL RECIENTE: PLEGABLE EN TELÉFONO, SIEMPRE VISIBLE EN ESCRITORIO */}
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
