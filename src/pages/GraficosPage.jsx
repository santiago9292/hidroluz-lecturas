import { useEffect, useMemo, useState } from 'react';
import { subDays, format, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Building2,
  Download,
  Droplets,
  Eye,
  FileSpreadsheet,
  FileVideo,
  Lock,
  Receipt,
  Zap,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { computePeriodAndTariffSummary } from '@/lib/consumption';
import { formatAguaNumber, formatLuzNumber } from '@/lib/obis';
import MediaModal from '@/components/MediaModal';

export default function GraficosPage() {
  const { currentUser, sedes, meters, readings } = useApp();
  const isSysadmin = currentUser?.rol === 'sysadmin';

  const [selectedSedeId, setSelectedSedeId] = useState(
    currentUser?.sede_id || sedes[0]?.id || ''
  );
  const [daysFilter, setDaysFilter] = useState(30);
  const [viewingMediaItem, setViewingMediaItem] = useState(null);

  useEffect(() => {
    if (!isSysadmin && currentUser?.sede_id) {
      setSelectedSedeId(currentUser.sede_id);
    } else if (!selectedSedeId && sedes.length > 0) {
      setSelectedSedeId(sedes[0].id);
    }
  }, [isSysadmin, currentUser, sedes, selectedSedeId]);

  const activeSede = sedes.find((s) => s.id === selectedSedeId) || null;

  const luzMeters = useMemo(
    () => meters.filter((m) => m.sede_id === selectedSedeId && m.tipo === 'luz'),
    [meters, selectedSedeId]
  );
  const aguaMeters = useMemo(
    () => meters.filter((m) => m.sede_id === selectedSedeId && m.tipo === 'agua'),
    [meters, selectedSedeId]
  );

  const primaryLuzMeter = luzMeters[0] || null;
  const primaryAguaMeter = aguaMeters[0] || null;

  const luzBilling = useMemo(() => {
    if (!primaryLuzMeter) return null;
    const mReadings = readings.filter((r) => r.meter_id === primaryLuzMeter.id);
    return computePeriodAndTariffSummary({
      readings: mReadings,
      meter: primaryLuzMeter,
      referenceDate: new Date(),
    });
  }, [primaryLuzMeter, readings]);

  const aguaBilling = useMemo(() => {
    if (!primaryAguaMeter) return null;
    const mReadings = readings.filter((r) => r.meter_id === primaryAguaMeter.id);
    return computePeriodAndTariffSummary({
      readings: mReadings,
      meter: primaryAguaMeter,
      referenceDate: new Date(),
    });
  }, [primaryAguaMeter, readings]);

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

  const luzChartData = useMemo(
    () =>
      sedeReadings
        .filter((r) => r.tipo === 'luz' && Number(r.calculos?.promedioDiario ?? r.consumo_diario) > 0)
        .map((r) => ({
          fecha: format(parseISO(r.fecha_lectura), 'dd/MM'),
          consumoDiario: Number(r.calculos?.promedioDiario ?? r.consumo_diario),
        })),
    [sedeReadings]
  );

  const aguaChartData = useMemo(
    () =>
      sedeReadings
        .filter((r) => r.tipo === 'agua' && Number(r.calculos?.promedioDiario ?? r.consumo_diario) > 0)
        .map((r) => ({
          fecha: format(parseISO(r.fecha_lectura), 'dd/MM'),
          consumoDiario: Number(r.calculos?.promedioDiario ?? r.consumo_diario),
        })),
    [sedeReadings]
  );

  const exportPeriodSummaryCsv = () => {
    if (!luzBilling && !aguaBilling) return;

    const rows = [];
    const headers = [
      'SEDE',
      'Servicio',
      'Tarifa',
      'Periodo',
      'Inicio Corte',
      'Fin Corte',
      'kWh HP',
      'kWh HFP',
      'Consumo Total (kWh o m3)',
      'Promedio Diario (24h)',
      'Proyección al Corte',
      'Demanda HP (kW)',
      'Demanda HFP (kW)',
      'Demanda Máx Mes (kW)',
      'Potencia Dist. Estimada Total (kW)',
      'Potencia Dist. Estimada HP (kW)',
      'Horas HP Periodo',
      'Factor Calificación',
      'Estado Calificación',
      'Reactiva Total (kVARh)',
      '% Reactiva/Activa',
      'Reactiva Excedente >30% (kVARh)',
    ];

    if (luzBilling) {
      luzBilling.allPeriods.forEach((p) => {
        const isCurr = p.key === luzBilling.currentPeriod.key;
        rows.push([
          activeSede?.nombre || '',
          'LUZ',
          luzBilling.config.tarifa,
          p.key,
          p.start.toLocaleDateString('es-PE'),
          p.end.toLocaleDateString('es-PE'),
          p.kWhHP !== null ? formatLuzNumber(p.kWhHP) : '',
          p.kWhHFP !== null ? formatLuzNumber(p.kWhHFP) : '',
          formatLuzNumber(p.kWhTotal),
          formatLuzNumber(p.promedioDiarioPeriodo),
          formatLuzNumber(p.proyeccionCorte),
          p.demandaHPMax !== null ? formatLuzNumber(p.demandaHPMax) : '',
          p.demandaHFPMax !== null ? formatLuzNumber(p.demandaHFPMax) : '',
          p.demandaMaximaMes !== null ? formatLuzNumber(p.demandaMaximaMes) : '',
          isCurr && luzBilling.currentPeriod.potenciaDistribucionTotal !== null
            ? formatLuzNumber(luzBilling.currentPeriod.potenciaDistribucionTotal)
            : '',
          isCurr && luzBilling.currentPeriod.potenciaDistribucionHP !== null
            ? formatLuzNumber(luzBilling.currentPeriod.potenciaDistribucionHP)
            : '',
          p.horasHPPeriodo,
          p.calificacion ?? '',
          p.calificacionTexto ?? '',
          formatLuzNumber(p.kVARhTotal),
          formatLuzNumber(p.reactivaPct),
          formatLuzNumber(p.reactivaExcedente),
        ]);
      });
    }

    if (aguaBilling) {
      aguaBilling.allPeriods.forEach((p) => {
        rows.push([
          activeSede?.nombre || '',
          'AGUA',
          'AGUA',
          p.key,
          p.start.toLocaleDateString('es-PE'),
          p.end.toLocaleDateString('es-PE'),
          '',
          '',
          formatAguaNumber(p.kWhTotal),
          formatAguaNumber(p.promedioDiarioPeriodo),
          formatAguaNumber(p.proyeccionCorte),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      });
    }

    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumen-recibo-${activeSede?.codigo || 'sede'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRawReadingsCsv = () => {
    const obisKeySet = new Set(['1.8.1', '1.8.2', '1.6.1', '1.6.2', '1.6.2.1', '3.8.0']);
    sedeReadings.forEach((r) => {
      if (r.lecturas_obis) {
        Object.keys(r.lecturas_obis).forEach((k) => obisKeySet.add(k));
      }
    });
    const obisColumns = Array.from(obisKeySet);

    const headers = [
      'Fecha y Hora',
      'Operador',
      'SEDE',
      'Servicio',
      'Valor Crudo Agua (m3)',
      ...obisColumns.map((k) => `Crudo ${k}`),
      'Horas Transcurridas',
      'Consumo HP (kWh)',
      'Consumo HFP (kWh)',
      'Consumo Total Tramo',
      'Promedio Diario (24h)',
      'Demanda Máx Lectura (kW)',
      'Evento',
      'Evidencia URL',
    ];

    const rows = [...sedeReadings].reverse().map((r) => {
      const isLuz = r.tipo === 'luz';
      const fmt = isLuz ? formatLuzNumber : formatAguaNumber;
      const obis = r.lecturas_obis || {};
      const c = r.calculos || {};
      return [
        new Date(r.fecha_lectura).toLocaleString('es-PE'),
        r.usuario_nombre,
        activeSede?.nombre || '',
        r.tipo.toUpperCase(),
        isLuz ? '' : formatAguaNumber(r.valor_crudo ?? r.valor_lectura),
        ...obisColumns.map((k) => (obis[k] !== undefined ? formatLuzNumber(obis[k]) : '')),
        c.horasTranscurridas ?? '',
        c.consumoHP !== null && c.consumoHP !== undefined ? formatLuzNumber(c.consumoHP) : '',
        c.consumoHFP !== null && c.consumoHFP !== undefined ? formatLuzNumber(c.consumoHFP) : '',
        fmt(c.consumoTotal ?? r.consumo_total_periodo ?? 0),
        fmt(c.promedioDiario ?? r.consumo_diario ?? 0),
        c.demandaMaxLectura !== null && c.demandaMaxLectura !== undefined
          ? formatLuzNumber(c.demandaMaxLectura)
          : '',
        r.evento_lectura || 'normal',
        r.media_url || '',
      ];
    });

    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lecturas-crudas-${activeSede?.codigo || 'sede'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const cpLuz = luzBilling?.currentPeriod || null;
  const cpAgua = aguaBilling?.currentPeriod || null;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Resumen de Facturación y Gráficos por Sede
          </h2>
          <p className="text-sm text-slate-500">
            Cálculo del periodo actual comparable con tu recibo eléctrico y de agua.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={exportPeriodSummaryCsv}
            className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Resumen Recibo (.CSV)
          </button>

          {isSysadmin ? (
            <div className="relative min-w-52">
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

      {/* RESUMEN DEL PERIODO COMPARABLE CON EL RECIBO */}
      {cpLuz && luzBilling && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Periodo Eléctrico Actual ({luzBilling.config.tarifa}) ·{' '}
                  {cpLuz.start.toLocaleDateString('es-PE')} al{' '}
                  {cpLuz.end.toLocaleDateString('es-PE')}
                </h3>
                <p className="text-xs text-slate-500">
                  Factor Energía: ×{luzBilling.config.factor_energia} · Factor Demanda: ×
                  {luzBilling.config.factor_demanda} · Corte día {luzBilling.config.dia_corte}
                </p>
              </div>
            </div>

            {cpLuz.calificacionTexto && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                  cpLuz.calificacionTexto === 'presente en punta'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {cpLuz.calificacionTexto} ({cpLuz.calificacion})
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Energía Total</span>
              <p className="text-lg font-mono font-extrabold text-slate-900 mt-0.5">
                {formatLuzNumber(cpLuz.kWhTotal)} <span className="text-xs font-normal">kWh</span>
              </p>
              <span className="text-[10px] text-slate-500">
                Proy. corte: {formatLuzNumber(cpLuz.proyeccionCorte)} kWh
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">kWh HP / HFP</span>
              <p className="text-sm font-mono font-extrabold text-slate-900 mt-1">
                {cpLuz.kWhHP !== null
                  ? `${formatLuzNumber(cpLuz.kWhHP)} / ${formatLuzNumber(cpLuz.kWhHFP)}`
                  : 'Definir HP/HFP'}
              </p>
              <span className="text-[10px] text-slate-500">
                Prom: {formatLuzNumber(cpLuz.promedioDiarioPeriodo)} kWh/d
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Demanda Máx. Mes
              </span>
              <p className="text-lg font-mono font-extrabold text-slate-900 mt-0.5">
                {cpLuz.demandaMaximaMes !== null
                  ? `${formatLuzNumber(cpLuz.demandaMaximaMes)} kW`
                  : '—'}
              </p>
              <span className="text-[10px] text-slate-500">
                HP: {cpLuz.demandaHPMax !== null ? formatLuzNumber(cpLuz.demandaHPMax) : '—'} · HFP:{' '}
                {cpLuz.demandaHFPMax !== null ? formatLuzNumber(cpLuz.demandaHFPMax) : '—'} kW
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Potencia Dist. (6m)
              </span>
              <p className="text-lg font-mono font-extrabold text-indigo-700 mt-0.5">
                {cpLuz.potenciaDistribucionTotal !== null
                  ? `${formatLuzNumber(cpLuz.potenciaDistribucionTotal)} kW`
                  : 'N/A'}
              </p>
              <span className="text-[10px] text-slate-500">
                Pot. HP (6m):{' '}
                {cpLuz.potenciaDistribucionHP !== null
                  ? formatLuzNumber(cpLuz.potenciaDistribucionHP)
                  : '—'}{' '}
                kW
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">Calificación</span>
              <p className="text-lg font-mono font-extrabold text-slate-900 mt-0.5">
                {cpLuz.calificacion !== null ? cpLuz.calificacion : '—'}
              </p>
              <span className="text-[10px] text-slate-500">
                Horas HP tramo: {cpLuz.horasHPPeriodo} h
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Reactiva Excedente
              </span>
              <p className="text-lg font-mono font-extrabold text-slate-900 mt-0.5">
                {formatLuzNumber(cpLuz.reactivaExcedente)}{' '}
                <span className="text-xs font-normal">kVARh</span>
              </p>
              <span className="text-[10px] text-slate-500">
                Total: {formatLuzNumber(cpLuz.kVARhTotal)} kVARh ({formatLuzNumber(cpLuz.reactivaPct)}
                %)
              </span>
            </div>
          </div>

          {cpAgua && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-bold text-sky-800">
                <Droplets className="w-4 h-4 text-sky-600" />
                Periodo Agua ({cpAgua.start.toLocaleDateString('es-PE')} –{' '}
                {cpAgua.end.toLocaleDateString('es-PE')}):
              </span>
              <div className="flex flex-wrap gap-4 font-mono">
                <span>
                  Acumulado:{' '}
                  <strong className="text-slate-900">{formatAguaNumber(cpAgua.kWhTotal)} m³</strong>
                </span>
                <span>
                  Promedio diario:{' '}
                  <strong className="text-slate-900">
                    {formatAguaNumber(cpAgua.promedioDiarioPeriodo)} m³/d
                  </strong>
                </span>
                <span>
                  Proyección al corte:{' '}
                  <strong className="text-sky-700">
                    {formatAguaNumber(cpAgua.proyeccionCorte)} m³
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controles de rango */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
          Curvas de Promedio Diario (24h)
        </h3>
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
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                daysFilter === opt.value
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Promedio Diario de Energía (kWh/24h)
              </h3>
              <p className="text-xs text-slate-500">Formato 2 decimales (0.00)</p>
            </div>
          </div>

          <div className="h-68 w-full">
            {luzChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Registra al menos 2 lecturas de luz para graficar.
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
                    }}
                    formatter={(val) => [`${formatLuzNumber(val)} kWh/día`, 'Promedio 24h']}
                  />
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
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Promedio Diario de Agua (m³/24h)
              </h3>
              <p className="text-xs text-slate-500">Formato 3 decimales (0.000)</p>
            </div>
          </div>

          <div className="h-68 w-full">
            {aguaChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Registra al menos 2 lecturas de agua para graficar.
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
                    }}
                    formatter={(val) => [`${formatAguaNumber(val)} m³/día`, 'Promedio 24h']}
                  />
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

      {/* Bitácora detallada */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-900 text-base">
            Bitácora de Lecturas Crudas y Consumos Calculados ({activeSede?.nombre})
          </h3>
          {sedeReadings.length > 0 && (
            <button
              onClick={exportRawReadingsCsv}
              className="self-start px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Exportar Lecturas (.CSV)
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 pr-4">Fecha / Hora</th>
                <th className="py-3 px-3">Servicio</th>
                <th className="py-3 px-3">Valores Crudos</th>
                <th className="py-3 px-3">Consumo (×Factor)</th>
                <th className="py-3 px-3">Prom. 24h</th>
                <th className="py-3 px-3">Operador</th>
                <th className="py-3 pl-3 text-right">Evidencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...sedeReadings].reverse().slice(0, 30).map((r) => {
                const isLuz = r.tipo === 'luz';
                const unit = isLuz ? 'kWh' : 'm³';
                const fmt = isLuz ? formatLuzNumber : formatAguaNumber;
                const obisEntries = r.lecturas_obis ? Object.entries(r.lecturas_obis) : [];
                const c = r.calculos || {};
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
                          isLuz ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {isLuz ? 'Luz' : 'Agua'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {obisEntries.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {obisEntries.map(([code, val]) => (
                            <span
                              key={code}
                              className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-800"
                            >
                              {code}: <strong>{formatLuzNumber(val)}</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-slate-900">
                          {fmt(r.valor_crudo ?? r.valor_lectura)} {unit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-800 whitespace-nowrap">
                      <strong>{fmt(c.consumoTotal ?? r.consumo_total_periodo ?? 0)}</strong> {unit}
                      {isLuz && c.consumoHP !== null && c.consumoHP !== undefined && (
                        <span className="block text-[10px] text-slate-500">
                          HP:{formatLuzNumber(c.consumoHP)} · HFP:{formatLuzNumber(c.consumoHFP)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {fmt(c.promedioDiario ?? r.consumo_diario ?? 0)} {unit}/d
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500">{r.usuario_nombre}</td>
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
