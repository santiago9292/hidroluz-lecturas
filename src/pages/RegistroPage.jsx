import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
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
  const [observaciones, setObservaciones] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewingMediaItem, setViewingMediaItem] = useState(null);

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Sincronizar sede seleccionada cuando cargan las sedes o cambia el usuario
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

  const meterReadingsHistory = useMemo(
    () =>
      readings
        .filter((r) => r.meter_id === selectedMeterId)
        .sort((a, b) => new Date(b.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime()),
    [readings, selectedMeterId]
  );

  const lastReading = meterReadingsHistory[0] || null;

  // Evaluación instantánea en vivo mientras el usuario digita
  const liveEval = useMemo(() => {
    if (!activeMeter || valorLectura === '' || Number.isNaN(Number(valorLectura))) {
      return null;
    }
    return evaluateReadingConsumption({
      valorLectura: Number(valorLectura),
      fechaLectura: new Date().toISOString(),
      meter: activeMeter,
      previousReadings: meterReadingsHistory,
    });
  }, [activeMeter, valorLectura, meterReadingsHistory]);

  // Previsualización segura de archivo seleccionado
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeSede || !activeMeter) {
      showToast('Selecciona una sede y medidor válidos.', 'error');
      return;
    }
    if (valorLectura === '') {
      showToast('Ingresa la lectura actual del medidor.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { alert } = await registerMeterReading({
        currentUser,
        sede: activeSede,
        meter: activeMeter,
        valorLectura: Number(valorLectura),
        observaciones,
        file: mediaFile,
        previousReadings: meterReadingsHistory,
      });

      await refreshData(true);
      setValorLectura('');
      setObservaciones('');
      clearMedia();

      if (alert) {
        showToast(
          `⚠️ Lectura guardada con ALERTA: ${alert.mensaje}`,
          'warning',
          7000
        );
      } else {
        showToast('Lectura y evidencia registradas correctamente.', 'success');
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

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Registro de Lecturas
          </h2>
          <p className="text-sm text-slate-400">
            Ingresa el valor actual del medidor y adjunta la foto o video de respaldo.
          </p>
        </div>

        {/* Selector de sede (bloqueado para operario, editable para sysadmin) */}
        <div className="sm:w-72">
          {isSysadmin ? (
            <div className="relative">
              <Building2 className="w-4 h-4 text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedSedeId}
                onChange={(e) => setSelectedSedeId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:border-sky-400 outline-none"
              >
                {availableSedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.codigo})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-semibold text-white truncate">
                  {activeSede?.nombre || 'Mi Sede'}
                </span>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                <Lock className="w-3 h-3" /> Fija
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: FORMULARIO DE REGISTRO */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl"
        >
          {/* Selector de Servicio: Luz vs Agua */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              1. Tipo de Servicio
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUtilityType('luz')}
                className={`p-4 rounded-2xl border flex items-center gap-3 transition cursor-pointer ${
                  utilityType === 'luz'
                    ? 'bg-amber-500/15 border-amber-400/60 text-amber-200 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl ${
                    utilityType === 'luz' ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-800'
                  }`}
                >
                  <Zap className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm sm:text-base text-white">Energía Eléctrica</p>
                  <p className="text-xs opacity-80">Medición en kWh</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUtilityType('agua')}
                className={`p-4 rounded-2xl border flex items-center gap-3 transition cursor-pointer ${
                  utilityType === 'agua'
                    ? 'bg-sky-500/15 border-sky-400/60 text-sky-200 shadow-lg shadow-sky-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl ${
                    utilityType === 'agua' ? 'bg-sky-400/20 text-sky-300' : 'bg-slate-800'
                  }`}
                >
                  <Droplets className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm sm:text-base text-white">Agua Potable</p>
                  <p className="text-xs opacity-80">Medición en m³</p>
                </div>
              </button>
            </div>
          </div>

          {/* Selector de medidor (soporta múltiples medidores por sede) */}
          {filteredMeters.length > 1 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Medidor Específico en la Sede
              </label>
              <select
                value={selectedMeterId}
                onChange={(e) => setSelectedMeterId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-sky-400 outline-none"
              >
                {filteredMeters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.numero_serie ? `(Serie: ${m.numero_serie})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tarjeta de referencia de lectura previa */}
          {activeMeter ? (
            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block">Última lectura</span>
                <p className="text-base sm:text-lg font-mono font-bold text-white mt-0.5">
                  {lastReading
                    ? `${lastReading.valor_lectura} ${activeMeter.unidad}`
                    : 'Sin previos'}
                </p>
                {lastReading && (
                  <span className="text-[11px] text-slate-500">
                    {new Date(lastReading.fecha_lectura).toLocaleDateString('es-PE')}
                  </span>
                )}
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Umbral diario máx.</span>
                <p className="text-base sm:text-lg font-mono font-semibold text-slate-200 mt-0.5">
                  {activeMeter.umbral_diario_max
                    ? `${activeMeter.umbral_diario_max} ${activeMeter.unidad}/día`
                    : 'Automático'}
                </p>
                <span className="text-[11px] text-slate-500">
                  +{activeMeter.porcentaje_alerta_promedio || 30}% máx. s/prom.
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-400 block">Medidor activo</span>
                <p className="text-sm font-semibold text-slate-200 truncate mt-0.5">
                  {activeMeter.nombre}
                </p>
                <span className="text-[11px] text-slate-500 font-mono">
                  {activeMeter.numero_serie || 'Serie estándar'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
              Esta sede aún no tiene medidores activos de {utilityType}. El Sysadmin puede agregarlos
              desde el panel de administración.
            </div>
          )}

          {/* Input de lectura actual */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              2. Lectura Actual del Medidor ({activeMeter?.unidad || ''})
            </label>
            <div className="relative">
              <Gauge className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
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
                className="w-full pl-12 pr-20 py-4 rounded-2xl bg-slate-950 border border-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 outline-none text-xl font-mono font-bold text-white"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-mono font-semibold text-slate-300">
                {activeMeter?.unidad || (utilityType === 'luz' ? 'kWh' : 'm3')}
              </span>
            </div>
          </div>

          {/* Previsualización instantánea del consumo diario y semáforo de anomalías */}
          {liveEval && activeMeter && (
            <div
              className={`rounded-2xl p-4 border transition ${
                liveEval.esAnomalo
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-100'
                  : 'bg-emerald-950/35 border-emerald-500/40 text-emerald-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {liveEval.esAnomalo ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-sm">
                      {liveEval.esAnomalo
                        ? '¡Atención! Se generará una Alerta Automática'
                        : 'Cálculo de Consumo Diario dentro del rango normal'}
                    </p>
                    <span className="font-mono text-sm font-extrabold px-2.5 py-0.5 rounded-lg bg-black/30">
                      {liveEval.consumoDiario} {activeMeter.unidad}/día
                    </span>
                  </div>
                  <p className="text-xs opacity-90">
                    Variación total: <strong>{liveEval.consumoTotalPeriodo}</strong>{' '}
                    {activeMeter.unidad} en <strong>{liveEval.diasTranscurridos}</strong> día(s)
                    {liveEval.promedioPrevio !== null &&
                      ` · Promedio previo: ${liveEval.promedioPrevio} ${activeMeter.unidad}/día`}
                  </p>
                  {liveEval.motivoAnomalia && (
                    <p className="text-xs font-medium text-rose-200 pt-1">
                      {liveEval.motivoAnomalia}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Captura o subida de Foto / Video hacia Supabase Storage */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              3. Evidencia Fotográfica o Video del Medidor
            </label>

            {/* Inputs nativos ocultos para cámara móvil y selector de escritorio */}
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
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-dashed border-slate-700 hover:border-sky-400 text-slate-300 transition cursor-pointer"
                >
                  <Camera className="w-6 h-6 text-sky-400" />
                  <span className="text-xs font-semibold">Tomar Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-dashed border-slate-700 hover:border-indigo-400 text-slate-300 transition cursor-pointer"
                >
                  <Video className="w-6 h-6 text-indigo-400" />
                  <span className="text-xs font-semibold">Grabar Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-dashed border-slate-700 hover:border-emerald-400 text-slate-300 transition cursor-pointer"
                >
                  <ImagePlus className="w-6 h-6 text-emerald-400" />
                  <span className="text-xs font-semibold">Subir Archivo</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-950 border border-slate-700 overflow-hidden">
                <div className="relative max-h-60 bg-black flex items-center justify-center">
                  {mediaFile.type.startsWith('video/') ? (
                    <video
                      src={mediaPreviewUrl}
                      controls
                      className="max-h-60 w-full object-contain"
                    />
                  ) : (
                    <img
                      src={mediaPreviewUrl}
                      alt="Vista previa"
                      className="max-h-60 w-full object-contain"
                    />
                  )}
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-slate-900">
                  <span className="text-xs text-slate-300 truncate">
                    {mediaFile.name} ({(mediaFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              4. Observaciones (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ej. Medidor verificado sin fugas visibles, turno mañana..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 focus:border-sky-400 outline-none text-sm text-white placeholder:text-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !activeMeter || valorLectura === ''}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-sky-500/20 transition cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Subiendo y guardando lectura...' : 'Guardar Lectura del Medidor'}</span>
          </button>
        </form>

        {/* COLUMNA DERECHA: ÚLTIMOS REGISTROS EN TIEMPO REAL DE LA SEDE */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-sky-400" />
              <h3 className="font-bold text-base text-white">Últimos Registros de la Sede</h3>
            </div>
            <span className="text-xs text-slate-400">{sedeRecentReadings.length} recientes</span>
          </div>

          {sedeRecentReadings.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Aún no hay lecturas registradas en esta sede.
            </p>
          ) : (
            <div className="space-y-3">
              {sedeRecentReadings.map((item) => {
                const isLuz = item.tipo === 'luz';
                const unit = isLuz ? 'kWh' : 'm³';
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition ${
                      item.es_anomalo
                        ? 'bg-rose-950/25 border-rose-500/40'
                        : 'bg-slate-950/60 border-slate-800/90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-xl ${
                            isLuz
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-sky-500/15 text-sky-300'
                          }`}
                        >
                          {isLuz ? <Zap className="w-4 h-4" /> : <Droplets className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-white">
                              {item.valor_lectura} {unit}
                            </span>
                            {item.es_anomalo && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                ANÓMALO
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
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

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-300">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {item.consumo_diario} {unit}/d
                        </span>
                        {item.media_url && (
                          <button
                            type="button"
                            onClick={() => setViewingMediaItem(item)}
                            className="mt-1 flex items-center gap-1 ml-auto px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300 cursor-pointer"
                          >
                            {item.media_tipo === 'video' ? (
                              <FileVideo className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            Ver {item.media_tipo || 'evidencia'}
                          </button>
                        )}
                      </div>
                    </div>

                    {item.motivo_anomalia && (
                      <p className="mt-2 text-[11px] text-rose-300 bg-rose-950/40 px-2.5 py-1.5 rounded-xl">
                        {item.motivo_anomalia}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MediaModal item={viewingMediaItem} onClose={() => setViewingMediaItem(null)} />
    </div>
  );
}
