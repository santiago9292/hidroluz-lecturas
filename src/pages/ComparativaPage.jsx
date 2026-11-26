import { useMemo, useState } from 'react';
import { subDays, format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, Droplets, GitCompareArrows, Zap } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const SEDE_COLORS = ['#0284c7', '#d97706', '#059669', '#db2777', '#7c3aed', '#ea580c'];

export default function ComparativaPage() {
  const { sedes, readings, alerts } = useApp();
  const [daysFilter, setDaysFilter] = useState(14);
  const [utilityTab, setUtilityTab] = useState('luz');
  const [selectedSedeIds, setSelectedSedeIds] = useState(() => sedes.map((s) => s.id));

  const activeIds =
    selectedSedeIds.length > 0 ? selectedSedeIds : sedes.map((s) => s.id);

  const toggleSede = (id) => {
    setSelectedSedeIds((prev) => {
      const base = prev.length > 0 ? prev : sedes.map((s) => s.id);
      if (base.includes(id)) {
        return base.length > 1 ? base.filter((x) => x !== id) : base;
      }
      return [...base, id];
    });
  };

  const cutoffTime = useMemo(
    () => (daysFilter > 0 ? subDays(new Date(), daysFilter).getTime() : 0),
    [daysFilter]
  );

  const comparisonSummary = useMemo(() => {
    return sedes
      .filter((s) => activeIds.includes(s.id))
      .map((sede, index) => {
        const sr = readings.filter(
          (r) =>
            r.sede_id === sede.id &&
            new Date(r.fecha_lectura).getTime() >= cutoffTime &&
            Number(r.consumo_diario) > 0
        );
        const luzList = sr.filter((r) => r.tipo === 'luz');
        const aguaList = sr.filter((r) => r.tipo === 'agua');

        const luzTotal = luzList.reduce((acc, r) => acc + Number(r.consumo_diario), 0);
        const luzPromedio = luzList.length ? luzTotal / luzList.length : 0;

        const aguaTotal = aguaList.reduce((acc, r) => acc + Number(r.consumo_diario), 0);
        const aguaPromedio = aguaList.length ? aguaTotal / aguaList.length : 0;

        const sedeAlerts = alerts.filter(
          (a) => a.sede_id === sede.id && !a.resuelta
        ).length;

        return {
          id: sede.id,
          nombre: sede.nombre,
          codigo: sede.codigo,
          color: SEDE_COLORS[index % SEDE_COLORS.length],
          luzTotal: Number(luzTotal.toFixed(1)),
          luzPromedio: Number(luzPromedio.toFixed(1)),
          aguaTotal: Number(aguaTotal.toFixed(1)),
          aguaPromedio: Number(aguaPromedio.toFixed(1)),
          alertasActivas: sedeAlerts,
          lecturasCount: sr.length,
        };
      });
  }, [sedes, activeIds, readings, alerts, cutoffTime]);

  const multiLineData = useMemo(() => {
    const byDateMap = new Map();

    readings
      .filter(
        (r) =>
          activeIds.includes(r.sede_id) &&
          r.tipo === utilityTab &&
          Number(r.consumo_diario) > 0 &&
          new Date(r.fecha_lectura).getTime() >= cutoffTime
      )
      .sort((a, b) => new Date(a.fecha_lectura).getTime() - new Date(b.fecha_lectura).getTime())
      .forEach((r) => {
        const dayKey = format(parseISO(r.fecha_lectura), 'dd/MM');
        const sede = sedes.find((s) => s.id === r.sede_id);
        if (!sede) return;
        const entry = byDateMap.get(dayKey) || { fecha: dayKey };
        entry[sede.nombre] = Number(r.consumo_diario);
        byDateMap.set(dayKey, entry);
      });

    return Array.from(byDateMap.values());
  }, [readings, activeIds, utilityTab, cutoffTime, sedes]);

  const tooltipLightStyle = {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: '14px',
    color: '#0f172a',
    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <GitCompareArrows className="w-6 h-6 text-sky-600" />
            Comparativa Multisede
          </h2>
          <p className="text-sm text-slate-500">
            Compara consumos diarios promedio, acumulados y anomalías entre todas tus sedes.
          </p>
        </div>

        <div className="inline-flex rounded-2xl bg-white border border-slate-200 p-1 self-start shadow-2xs">
          {[
            { label: '7 días', value: 7 },
            { label: '14 días', value: 14 },
            { label: '30 días', value: 30 },
            { label: 'Histórico', value: 0 },
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
      </div>

      {/* Selector de sedes */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-wrap items-center gap-2 shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-2">
          Sedes comparadas:
        </span>
        {sedes.map((sede, idx) => {
          const checked = activeIds.includes(sede.id);
          const color = SEDE_COLORS[idx % SEDE_COLORS.length];
          return (
            <button
              key={sede.id}
              onClick={() => toggleSede(sede.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                checked
                  ? 'bg-slate-50 border-slate-300 text-slate-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: checked ? color : '#cbd5e1' }}
              />
              {sede.nombre}
              {checked && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
          );
        })}
      </div>

      {/* Gráficos de Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-base">
              Comparativa de Luz por Sede (kWh/día vs Total)
            </h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="codigo" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipLightStyle} />
                <Legend />
                <Bar
                  dataKey="luzPromedio"
                  name="Promedio Diario (kWh/d)"
                  fill="#f59e0b"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="luzTotal"
                  name="Acumulado Periodo (kWh)"
                  fill="#ea580c"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Comparativa de Agua por Sede (m³/día vs Total)
            </h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="codigo" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipLightStyle} />
                <Legend />
                <Bar
                  dataKey="aguaPromedio"
                  name="Promedio Diario (m³/d)"
                  fill="#0284c7"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="aguaTotal"
                  name="Acumulado Periodo (m³)"
                  fill="#4f46e5"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Evolución Temporal Superpuesta */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Curva Comparativa Día a Día entre Sedes
            </h3>
            <p className="text-xs text-slate-500">
              Detecta qué sede presenta picos inusuales frente al resto de operaciones.
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 border border-slate-200 p-1 self-start">
            <button
              onClick={() => setUtilityTab('luz')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                utilityTab === 'luz' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Luz (kWh/día)
            </button>
            <button
              onClick={() => setUtilityTab('agua')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                utilityTab === 'agua' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" /> Agua (m³/día)
            </button>
          </div>
        </div>

        <div className="h-80">
          {multiLineData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              No hay lecturas suficientes en este rango para superponer curvas.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={multiLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="fecha" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipLightStyle} />
                <Legend />
                {comparisonSummary.map((s) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.nombre}
                    stroke={s.color}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabla Ranking Comparativa */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
        <h3 className="font-bold text-slate-900 text-base mb-4">Matriz Resumen por Sede</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 pr-4">Sede</th>
                <th className="py-3 px-3">Prom. Luz</th>
                <th className="py-3 px-3">Total Luz</th>
                <th className="py-3 px-3">Prom. Agua</th>
                <th className="py-3 px-3">Total Agua</th>
                <th className="py-3 px-3">Lecturas</th>
                <th className="py-3 pl-3 text-right">Alertas Activas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonSummary.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="py-3.5 pr-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span>{row.nombre}</span>
                      <span className="text-xs font-mono text-slate-400">({row.codigo})</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-mono font-bold text-amber-600">
                    {row.luzPromedio} kWh/d
                  </td>
                  <td className="py-3.5 px-3 font-mono text-slate-700">{row.luzTotal} kWh</td>
                  <td className="py-3.5 px-3 font-mono font-bold text-sky-600">
                    {row.aguaPromedio} m³/d
                  </td>
                  <td className="py-3.5 px-3 font-mono text-slate-700">{row.aguaTotal} m³</td>
                  <td className="py-3.5 px-3 font-mono text-slate-500">{row.lecturasCount}</td>
                  <td className="py-3.5 pl-3 text-right">
                    {row.alertasActivas > 0 ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                        {row.alertasActivas} activa(s)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        Sin alertas
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
