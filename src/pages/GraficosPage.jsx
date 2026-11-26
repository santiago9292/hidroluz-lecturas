import { useEffect, useMemo, useState } from 'react';
import { subDays, format, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Droplets,
  Eye,
  FileVideo,
  Lock,
  Zap,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import MediaModal from '@/components/MediaModal';

export default function GraficosPage() {
  const { currentUser, sedes, meters, readings } = useApp();
  const isSysadmin = currentUser?.rol === 'sysadmin';

  const [selectedSedeId, setSelectedSedeId] = useState(
    currentUser?.sede_id || sedes[0]?.id || ''
  );
  const [daysFilter, setDaysFilter] = useState(14);
  const [viewingMediaItem, setViewingMediaItem] = useState(null);

  useEffect(() => {
    if (!isSysadmin && currentUser?.sede_id) {
      setSelectedSedeId(currentUser.sede_id);
    } else if (!selectedSedeId && sedes.length > 0) {
      setSelectedSedeId(sedes[0].id);
    }
  }, [isSysadmin, currentUser, sedes, selectedSedeId]);

  const activeSede = sedes.find((s) => s.id === selectedSedeId) || null;

  const sedeReadings = useMemo(() => {
    const cutoff = daysFilter > 0 ? subDays(new Date(), daysFilter).getTime() : 0;
    return readings
      .filter(
        (r) =>
          r.sede_id === selectedSedeId &&
          new Date(r.fecha_lectura).getTime() >= cutoff
      )
      .sort((a, b) => new Date(a.fecha_lectura).getTime() - new Date(a.fecha_lectura).getTime());
  }, [readings, selectedSedeId, daysFilter]);

  const luzMeters = useMemo(
    () => meters.filter((m) => m.sede_id === selectedSedeId && m.tipo === 'luz'),
    [meters, selectedSedeId]
  );
  const aguaMeters = useMemo(
    () => meters.filter((m) => m.sede_id === selectedSedeId && m.tipo === 'agua'),
    [meters, selectedSedeId]
  );

  const luzThreshold = luzMeters[0]?.umbral_diario_max
    ? Number(luzMeters[0].umbral_diario_max)
    : null;
  const aguaThreshold = aguaMeters[0]?.umbral_diario_max
    ? Number(aguaMeters[0].umbral_diario_max)
    : null;

  const luzChartData = useMemo(
    () =>
      sedeReadings
        .filter((r) => r.tipo === 'luz' && Number(r.consumo_diario) > 0)
        .map((r) => ({
          fecha: format(parseISO(r.fecha_lectura), 'dd/MM'),
          fechaCompleta: new Date(r.fecha_lectura).toLocaleString('es-PE'),
          consumoDiario: Number(r.consumo_diario),
          lectura: Number(r.valor_lectura),
          anomalo: r.es_anomalo,
        })),
    [sedeReadings]
  );

  const aguaChartData = useMemo(
    () =>
      sedeReadings
        .filter((r) => r.tipo === 'agua' && Number(r.consumo_diario) > 0)
        .map((r) => ({
          fecha: format(parseISO(r.fecha_lectura), 'dd/MM'),
          fechaCompleta: new Date(r.fecha_lectura).toLocaleString('es-PE'),
          consumoDiario: Number(r.consumo_diario),
          lectura: Number(r.valor_lectura),
          anomalo: r.es_anomalo,
        })),
    [sedeReadings]
  );

  const stats = useMemo(() => {
    const luzTotal = luzChartData.reduce((acc, d) => acc + d.consumoDiario, 0);
    const luzAvg = luzChartData.length ? luzTotal / luzChartData.length : 0;
    const aguaTotal = aguaChartData.reduce((acc, d) => acc + d.consumoDiario, 0);
    const aguaAvg = aguaChartData.length ? aguaTotal / aguaChartData.length : 0;
    const anomaliesCount = sedeReadings.filter((r) => r.es_anomalo).length;

    return {
      luzTotal: luzTotal.toFixed(1),
      luzAvg: luzAvg.toFixed(1),
      aguaTotal: aguaTotal.toFixed(1),
      aguaAvg: aguaAvg.toFixed(1),
      anomaliesCount,
    };
  }, [luzChartData, aguaChartData, sedeReadings]);

  return (
    <div className="space-y-6">
      {/* Cabecera y controles */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Gráficos de Consumo por Sede
          </h2>
          <p className="text-sm text-slate-500">
            Monitoreo en tiempo real del consumo diario de energía eléctrica y agua potable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-2xl bg-white border border-slate-200 p-1 shadow-2xs">
            {[
              { label: '7D', value: 7 },
              { label: '14D', value: 14 },
              { label: '30D', value: 30 },
              { label: 'Todo', value: 0 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDaysFilter(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  daysFilter === opt.value
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isSysadmin ? (
            <div className="relative min-w-56">
              <Building2 className="w-4 h-4 text-sky-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedSedeId}
                onChange={(e) => setSelectedSedeId(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white border border-slate-300 shadow-2xs text-sm font-semibold text-slate-900 outline-none focus:border-sky-500"
              >
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="px-4 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Building2 className="w-4 h-4 text-sky-600" />
              <span>{activeSede?.nombre}</span>
              <Lock className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </div>
          )}
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-amber-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Promedio Luz
            </span>
            <Zap className="w-4.5 h-4.5" />
          </div>
          <p className="text-2xl font-mono font-extrabold text-slate-900">
            {stats.luzAvg} <span className="text-xs font-normal text-slate-500">kWh/día</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Acumulado periodo: {stats.luzTotal} kWh
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-sky-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Promedio Agua
            </span>
            <Droplets className="w-4.5 h-4.5" />
          </div>
          <p className="text-2xl font-mono font-extrabold text-slate-900">
            {stats.aguaAvg} <span className="text-xs font-normal text-slate-500">m³/día</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Acumulado periodo: {stats.aguaTotal} m³
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lecturas Periodo
            </span>
            <Calendar className="w-4.5 h-4.5" />
          </div>
          <p className="text-2xl font-mono font-extrabold text-slate-900">{sedeReadings.length}</p>
          <p className="text-xs text-slate-500 mt-1">Registros verificados en sede</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Anomalías
            </span>
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <p className="text-2xl font-mono font-extrabold text-slate-900">{stats.anomaliesCount}</p>
          <p className="text-xs text-slate-500 mt-1">Excesos sobre límite o promedio</p>
        </div>
      </div>

      {/* Gráficos de Consumo Diario: Luz y Agua */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Consumo Diario de Luz (kWh/día)
                </h3>
                <p className="text-xs text-slate-500">
                  {luzThreshold
                    ? `Línea roja punteada = Umbral máx. (${luzThreshold} kWh/día)`
                    : 'Evolución diaria registrada'}
                </p>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            {luzChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Registra al menos 2 lecturas de luz para graficar el consumo diario.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={luzChartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="luzGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '14px',
                      color: '#0f172a',
                      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
                    }}
                    formatter={(val) => [`${val} kWh/día`, 'Consumo Diario']}
                  />
                  {luzThreshold && (
                    <ReferenceLine
                      y={luzThreshold}
                      stroke="#e11d48"
                      strokeDasharray="5 5"
                      label={{
                        value: `Máx ${luzThreshold}`,
                        fill: '#e11d48',
                        fontSize: 11,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="consumoDiario"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    fill="url(#luzGrad)"
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Consumo Diario de Agua (m³/día)
                </h3>
                <p className="text-xs text-slate-500">
                  {aguaThreshold
                    ? `Línea roja punteada = Umbral máx. (${aguaThreshold} m³/día)`
                    : 'Evolución diaria registrada'}
                </p>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            {aguaChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Registra al menos 2 lecturas de agua para graficar el consumo diario.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aguaChartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aguaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '14px',
                      color: '#0f172a',
                      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
                    }}
                    formatter={(val) => [`${val} m³/día`, 'Consumo Diario']}
                  />
                  {aguaThreshold && (
                    <ReferenceLine
                      y={aguaThreshold}
                      stroke="#e11d48"
                      strokeDasharray="5 5"
                      label={{
                        value: `Máx ${aguaThreshold}`,
                        fill: '#e11d48',
                        fontSize: 11,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="consumoDiario"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fill="url(#aguaGrad)"
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bitácora detallada de la sede */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
        <h3 className="font-bold text-slate-900 text-base mb-4">
          Bitácora de Lecturas y Evidencias ({activeSede?.nombre})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 pr-4">Fecha</th>
                <th className="py-3 px-3">Servicio</th>
                <th className="py-3 px-3">Lectura</th>
                <th className="py-3 px-3">Consumo Diario</th>
                <th className="py-3 px-3">Operador</th>
                <th className="py-3 px-3">Estado</th>
                <th className="py-3 pl-3 text-right">Evidencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...sedeReadings].reverse().slice(0, 25).map((r) => {
                const unit = r.tipo === 'luz' ? 'kWh' : 'm³';
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(r.fecha_lectura).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          r.tipo === 'luz'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {r.tipo === 'luz' ? 'Luz' : 'Agua'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {r.valor_lectura} {unit}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {r.consumo_diario} {unit}/d
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500">{r.usuario_nombre}</td>
                    <td className="py-3 px-3">
                      {r.es_anomalo ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                          Anómalo
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {r.media_url ? (
                        <button
                          onClick={() => setViewingMediaItem(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-sky-700 cursor-pointer"
                        >
                          {r.media_tipo === 'video' ? (
                            <FileVideo className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          Ver
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <MediaModal item={viewingMediaItem} onClose={() => setViewingMediaItem(null)} />
    </div>
  );
}
