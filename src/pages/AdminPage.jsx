import { useState } from 'react';
import {
  Building2,
  Cpu,
  Droplets,
  Edit3,
  Gauge,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sliders,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  deleteMeterAdmin,
  deleteSedeAdmin,
  deleteUserAdmin,
  saveMeterAdmin,
  saveSedeAdmin,
  saveUserAdmin,
} from '@/lib/dataService';
import {
  DEFAULT_TRIFASICO_CODES,
  TARIFF_OPTIONS,
  buildDefaultTariffConfig,
  getTariffRuleDefaults,
  normalizeMeterConfig,
} from '@/lib/obis';
import { resetDemoDb } from '@/lib/demoData';

const WEEKDAYS = [
  { day: 1, short: 'Lun' },
  { day: 2, short: 'Mar' },
  { day: 3, short: 'Mié' },
  { day: 4, short: 'Jue' },
  { day: 5, short: 'Vie' },
  { day: 6, short: 'Sáb' },
  { day: 0, short: 'Dom' },
];

export default function AdminPage() {
  const { mode, currentUser, sedes, meters, users, refreshData, showToast } = useApp();

  const [activeTab, setActiveTab] = useState('sedes');
  const [searchQuery, setSearchQuery] = useState('');

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    id: null,
    dni: '',
    nombre_completo: '',
    rol: 'operario',
    sede_id: '',
    activo: true,
  });

  const [sedeModalOpen, setSedeModalOpen] = useState(false);
  const [sedeForm, setSedeForm] = useState({
    id: null,
    nombre: '',
    codigo: '',
    direccion: '',
    ciudad: '',
    activa: true,
    luzTrifasico: true,
    tarifaLuz: 'BT3',
  });

  const [meterModalOpen, setMeterModalOpen] = useState(false);
  const [meterForm, setMeterForm] = useState({
    id: null,
    sede_id: '',
    tipo: 'luz',
    nombre: '',
    numero_serie: '',
    es_trifasico: true,
    codigos_obis: DEFAULT_TRIFASICO_CODES,
    config_tarifaria: buildDefaultTariffConfig('luz', true),
    feriadosTexto: '',
    activo: true,
  });

  const openNewUser = () => {
    setUserForm({
      id: null,
      dni: '',
      nombre_completo: '',
      rol: 'operario',
      sede_id: sedes[0]?.id || '',
      activo: true,
    });
    setUserModalOpen(true);
  };

  const openEditUser = (u) => {
    setUserForm({
      id: u.id,
      dni: u.dni,
      nombre_completo: u.nombre_completo,
      rol: u.rol,
      sede_id: u.sede_id || '',
      activo: u.activo,
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      await saveUserAdmin(userForm);
      await refreshData(true);
      setUserModalOpen(false);
      showToast(
        userForm.id ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.',
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Error guardando usuario.', 'error');
    }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario ${u.nombre_completo} (DNI ${u.dni})?`)) return;
    try {
      await deleteUserAdmin(u.id, currentUser.id);
      await refreshData(true);
      showToast('Usuario eliminado.', 'success');
    } catch (err) {
      showToast(err.message || 'Error eliminando usuario.', 'error');
    }
  };

  const openNewSede = () => {
    setSedeForm({
      id: null,
      nombre: '',
      codigo: '',
      direccion: '',
      ciudad: '',
      activa: true,
      luzTrifasico: true,
      tarifaLuz: 'BT3',
    });
    setSedeModalOpen(true);
  };

  const openEditSede = (s) => {
    setSedeForm({
      id: s.id,
      nombre: s.nombre,
      codigo: s.codigo,
      direccion: s.direccion || '',
      ciudad: s.ciudad || '',
      activa: s.activa,
      luzTrifasico: true,
      tarifaLuz: 'BT3',
    });
    setSedeModalOpen(true);
  };

  const handleSaveSede = async (e) => {
    e.preventDefault();
    try {
      await saveSedeAdmin(sedeForm);
      await refreshData(true);
      setSedeModalOpen(false);
      showToast(
        sedeForm.id
          ? 'Sede actualizada correctamente.'
          : 'Sede creada. Configura el mapeo T1/T2 (HP/HFP) y factor en su medidor.',
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Error guardando sede.', 'error');
    }
  };

  const handleDeleteSede = async (s) => {
    if (
      !window.confirm(
        `¿Eliminar la sede "${s.nombre}" junto con sus medidores y lecturas asociadas?`
      )
    )
      return;
    try {
      await deleteSedeAdmin(s.id);
      await refreshData(true);
      showToast('Sede eliminada.', 'success');
    } catch (err) {
      showToast(err.message || 'Error eliminando sede.', 'error');
    }
  };

  const openNewMeter = (sedeId) => {
    const cfg = buildDefaultTariffConfig('luz', true);
    setMeterForm({
      id: null,
      sede_id: sedeId,
      tipo: 'luz',
      nombre: 'Medidor Trifásico Luz',
      numero_serie: '',
      es_trifasico: true,
      codigos_obis: DEFAULT_TRIFASICO_CODES.map((c) => ({ ...c })),
      config_tarifaria: cfg,
      feriadosTexto: '',
      activo: true,
    });
    setMeterModalOpen(true);
  };

  const openEditMeter = (m) => {
    const cfg = normalizeMeterConfig(m);
    setMeterForm({
      id: m.id,
      sede_id: m.sede_id,
      tipo: m.tipo,
      nombre: m.nombre,
      numero_serie: m.numero_serie || '',
      es_trifasico: Boolean(m.es_trifasico),
      codigos_obis:
        Array.isArray(m.codigos_obis) && m.codigos_obis.length > 0
          ? m.codigos_obis.map((c) => ({ ...c }))
          : DEFAULT_TRIFASICO_CODES.map((c) => ({ ...c })),
      config_tarifaria: cfg,
      feriadosTexto: Array.isArray(cfg.feriados_extra) ? cfg.feriados_extra.join(', ') : '',
      activo: m.activo,
    });
    setMeterModalOpen(true);
  };

  const updateCfg = (patch) => {
    setMeterForm((prev) => ({
      ...prev,
      config_tarifaria: {
        ...prev.config_tarifaria,
        ...patch,
      },
    }));
  };

  const updateUmbral = (key, val) => {
    setMeterForm((prev) => ({
      ...prev,
      config_tarifaria: {
        ...prev.config_tarifaria,
        umbrales: {
          ...prev.config_tarifaria.umbrales,
          [key]: val === '' ? '' : Number(val),
        },
      },
    }));
  };

  const handleTariffSelect = (newTarifa) => {
    const defaults = getTariffRuleDefaults(newTarifa);
    updateCfg({
      tarifa: newTarifa,
      ...defaults,
    });
  };

  const toggleWorkday = (dayNum) => {
    const current = meterForm.config_tarifaria.dias_laborables || [1, 2, 3, 4, 5, 6];
    const next = current.includes(dayNum)
      ? current.filter((d) => d !== dayNum)
      : [...current, dayNum].sort();
    updateCfg({ dias_laborables: next });
  };

  const handleSaveMeter = async (e) => {
    e.preventDefault();
    try {
      const extraDates = meterForm.feriadosTexto
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));

      await saveMeterAdmin({
        ...meterForm,
        config_tarifaria: {
          ...meterForm.config_tarifaria,
          feriados_extra: extraDates,
        },
      });
      await refreshData(true);
      setMeterModalOpen(false);
      showToast('Configuración tarifaria y de alertas guardada.', 'success');
    } catch (err) {
      showToast(err.message || 'Error guardando medidor.', 'error');
    }
  };

  const handleDeleteMeter = async (m) => {
    if (!window.confirm(`¿Eliminar el medidor "${m.nombre}"?`)) return;
    try {
      await deleteMeterAdmin(m.id);
      await refreshData(true);
      showToast('Medidor eliminado.', 'success');
    } catch (err) {
      showToast(err.message || 'Error eliminando medidor.', 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return u.dni.toLowerCase().includes(q) || u.nombre_completo.toLowerCase().includes(q);
  });

  const cfg = meterForm.config_tarifaria;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            Administración Tarifaria y Usuarios (Sysadmin)
          </h2>
          <p className="text-sm text-slate-500">
            Configura tarifas (BT/MT), factores de recibo, mapeo HP/HFP, día de corte y umbrales.
          </p>
        </div>

        {mode === 'demo' && (
          <button
            onClick={() => {
              if (window.confirm('¿Restaurar los datos de demostración iniciales?')) {
                resetDemoDb();
                refreshData(false);
                showToast('Datos de demostración restaurados.', 'info');
              }
            }}
            className="self-start px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Demo
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('sedes')}
          className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'sedes'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" /> Sedes y Medidores ({sedes.length})
        </button>
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'usuarios'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" /> Usuarios ({users.length})
        </button>
      </div>

      {/* PESTAÑA SEDES Y MEDIDORES */}
      {activeTab === 'sedes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openNewSede}
              className="px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Crear Nueva Sede
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {sedes.map((sede) => {
              const sedeMeters = meters.filter((m) => m.sede_id === sede.id);
              const assignedCount = users.filter((u) => u.sede_id === sede.id).length;

              return (
                <div
                  key={sede.id}
                  className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-slate-900">{sede.nombre}</h3>
                        <span className="px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-200 font-mono text-xs font-semibold text-sky-700">
                          {sede.codigo}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {sede.direccion || 'Sin dirección'} {sede.ciudad ? `· ${sede.ciudad}` : ''}{' '}
                        · {assignedCount} operario(s)
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditSede(sede)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        title="Editar sede"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSede(sede)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        title="Eliminar sede"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5" /> Medidores y Tarifa ({sedeMeters.length})
                      </span>
                      <button
                        onClick={() => openNewMeter(sede.id)}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar medidor
                      </button>
                    </div>

                    {sedeMeters.map((m) => {
                      const mCfg = normalizeMeterConfig(m);
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {m.tipo === 'luz' ? (
                              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <Droplets className="w-4 h-4 text-sky-600 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {m.nombre}
                                </p>
                                {m.tipo === 'luz' && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                    {mCfg.tarifa}
                                  </span>
                                )}
                                {m.es_trifasico && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      mCfg.hp_registro === 'sin_asignar'
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-indigo-100 text-indigo-800'
                                    }`}
                                  >
                                    {mCfg.hp_registro === 'sin_asignar'
                                      ? '3F · Definir HP/HFP'
                                      : `3F · HP=${mCfg.hp_registro}`}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Corte: <strong>día {mCfg.dia_corte}</strong>
                                {m.tipo === 'luz' && (
                                  <>
                                    {' '}
                                    · Factor E: <strong>×{mCfg.factor_energia}</strong> · D:{' '}
                                    <strong>×{mCfg.factor_demanda}</strong>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditMeter(m)}
                              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-xs font-bold text-sky-700 flex items-center gap-1 cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5" /> Configurar
                            </button>
                            <button
                              onClick={() => handleDeleteMeter(m)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA USUARIOS */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar usuario por DNI o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-300 focus:border-sky-500 outline-none text-sm text-slate-900 shadow-2xs"
              />
            </div>
            <button
              onClick={openNewUser}
              className="px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Nuevo Usuario con DNI
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 bg-slate-50/80">
                    <th className="py-3.5 px-5">DNI</th>
                    <th className="py-3.5 px-4">Nombre Completo</th>
                    <th className="py-3.5 px-4">Rol</th>
                    <th className="py-3.5 px-4">Sede Asignada</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const userSede = sedes.find((s) => s.id === u.sede_id);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-5 font-mono font-bold text-sky-700">{u.dni}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {u.nombre_completo}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              u.rol === 'sysadmin'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {u.rol === 'sysadmin' ? 'Sysadmin' : 'Operario'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {u.rol === 'sysadmin'
                            ? 'Todas las sedes'
                            : userSede?.nombre || 'Sin asignar'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              u.activo
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEditUser(u)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL USUARIO */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveUser}
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">
                {userForm.id ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">DNI *</label>
              <input
                type="text"
                required
                maxLength={15}
                value={userForm.dni}
                onChange={(e) =>
                  setUserForm({ ...userForm, dni: e.target.value.replace(/[^0-9A-Za-z]/g, '') })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={userForm.nombre_completo}
                onChange={(e) => setUserForm({ ...userForm, nombre_completo: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rol</label>
                <select
                  value={userForm.rol}
                  onChange={(e) => setUserForm({ ...userForm, rol: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                >
                  <option value="operario">Operario de Sede</option>
                  <option value="sysadmin">Sysadmin Global</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                <select
                  value={userForm.activo ? 'true' : 'false'}
                  onChange={(e) =>
                    setUserForm({ ...userForm, activo: e.target.value === 'true' })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>

            {userForm.rol === 'operario' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sede Asignada *
                </label>
                <select
                  required
                  value={userForm.sede_id}
                  onChange={(e) => setUserForm({ ...userForm, sede_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                >
                  <option value="">Selecciona una sede...</option>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({s.codigo})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
              >
                Guardar Usuario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL SEDE */}
      {sedeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSede}
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">
                {sedeForm.id ? 'Editar Sede' : 'Nueva Sede'}
              </h3>
              <button
                type="button"
                onClick={() => setSedeModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de Sede *
                </label>
                <input
                  type="text"
                  required
                  value={sedeForm.nombre}
                  onChange={(e) => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                  placeholder="Ej. LABORATORIO"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código *</label>
                <input
                  type="text"
                  required
                  value={sedeForm.codigo}
                  onChange={(e) =>
                    setSedeForm({ ...sedeForm, codigo: e.target.value.toUpperCase() })
                  }
                  placeholder="LAB-01"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ciudad</label>
                <input
                  type="text"
                  value={sedeForm.ciudad}
                  onChange={(e) => setSedeForm({ ...sedeForm, ciudad: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={sedeForm.direccion}
                  onChange={(e) => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                />
              </div>
            </div>

            {!sedeForm.id && (
              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
                <p className="text-xs font-bold text-sky-900">Medidor eléctrico inicial:</p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sedeForm.luzTrifasico ? 'trifasico' : 'monofasico'}
                    onChange={(e) =>
                      setSedeForm({ ...sedeForm, luzTrifasico: e.target.value === 'trifasico' })
                    }
                    className="px-2.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                  >
                    <option value="trifasico">Trifásico (OBIS)</option>
                    <option value="monofasico">Monofásico</option>
                  </select>
                  <select
                    value={sedeForm.tarifaLuz}
                    onChange={(e) => setSedeForm({ ...sedeForm, tarifaLuz: e.target.value })}
                    className="px-2.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                  >
                    {TARIFF_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        Tarifa {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSedeModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
              >
                Guardar Sede
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN COMPLETA POR MEDIDOR (TARIFA, FACTORES, CORTE, HP/HFP, 1.6.2.1, UMBRALES) */}
      {meterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveMeter}
            className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[94vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {meterForm.id ? 'Configuración Tarifaria y de Alertas' : 'Nuevo Medidor'}
                </h3>
                <p className="text-xs text-slate-500">
                  Revisa con el recibo eléctrico el factor de medición, tarifa y registro HP/HFP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMeterModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Datos básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Servicio</label>
                <select
                  value={meterForm.tipo}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setMeterForm({
                      ...meterForm,
                      tipo: nextType,
                      es_trifasico: nextType === 'luz' ? meterForm.es_trifasico : false,
                      config_tarifaria: buildDefaultTariffConfig(
                        nextType,
                        nextType === 'luz' ? meterForm.es_trifasico : false
                      ),
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                >
                  <option value="luz">Luz Eléctrica (kWh)</option>
                  <option value="agua">Agua Potable (m³)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre del Medidor *
                </label>
                <input
                  type="text"
                  required
                  value={meterForm.nombre}
                  onChange={(e) => setMeterForm({ ...meterForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">N° Serie</label>
                <input
                  type="text"
                  value={meterForm.numero_serie}
                  onChange={(e) => setMeterForm({ ...meterForm, numero_serie: e.target.value })}
                  placeholder="Ej. E-49201"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm"
                />
              </div>
            </div>

            {/* SECCIÓN ELÉCTRICA: TARIFA, FACTORES Y TRIFÁSICO OBIS */}
            {meterForm.tipo === 'luz' && (
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" /> 1. Parámetros Eléctricos y Recibo
                  </span>
                  <div className="inline-flex rounded-xl bg-white border border-slate-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => setMeterForm({ ...meterForm, es_trifasico: false })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        !meterForm.es_trifasico ? 'bg-slate-800 text-white' : 'text-slate-600'
                      }`}
                    >
                      Monofásico
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeterForm({ ...meterForm, es_trifasico: true })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        meterForm.es_trifasico ? 'bg-indigo-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      Trifásico (OBIS)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Opción Tarifaria
                    </label>
                    <select
                      value={cfg.tarifa}
                      onChange={(e) => handleTariffSelect(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900"
                    >
                      {TARIFF_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Factor Energía (ver recibo)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={cfg.factor_energia}
                      onChange={(e) => updateCfg({ factor_energia: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Factor Demanda (ver recibo)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={cfg.factor_demanda}
                      onChange={(e) => updateCfg({ factor_demanda: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-sm text-slate-900"
                    />
                  </div>
                </div>

                {/* Reglas tarifarias editables */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg.usa_potencia_variable)}
                      onChange={(e) => updateCfg({ usa_potencia_variable: e.target.checked })}
                    />
                    Potencia variable (6 meses)
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg.aplica_calificacion)}
                      onChange={(e) => updateCfg({ aplica_calificacion: e.target.checked })}
                    />
                    Calificación HP/HFP (0.50)
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg.cobra_reactiva)}
                      onChange={(e) => updateCfg({ cobra_reactiva: e.target.checked })}
                    />
                    Cobra Reactiva (&gt;30% kWh)
                  </label>
                </div>

                {/* Configuración exclusiva Trifásico: Mapeo HP/HFP, 1.6.2.1 y Reactiva */}
                {meterForm.es_trifasico && (
                  <div className="space-y-3 pt-2 border-t border-amber-200/80">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        ¿Qué registro es Hora Punta (HP) y cuál Fuera de Punta (HFP)? *
                      </label>
                      <select
                        value={cfg.hp_registro}
                        onChange={(e) => updateCfg({ hp_registro: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm font-bold ${
                          cfg.hp_registro === 'sin_asignar'
                            ? 'bg-rose-50 border-rose-300 text-rose-800'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="sin_asignar">
                          ⚠️ Sin asignar — No asumir (seleccionar según programación del medidor)
                        </option>
                        <option value="T1">
                          T1 (1.8.1 / 1.6.1) = Hora Punta (HP) · T2 (1.8.2 / 1.6.2) = Fuera de Punta (HFP)
                        </option>
                        <option value="T2">
                          T2 (1.8.2 / 1.6.2) = Hora Punta (HP) · T1 (1.8.1 / 1.6.1) = Fuera de Punta (HFP)
                        </option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Significado del código 1.6.2.1 en este medidor
                        </label>
                        <select
                          value={cfg.modo_1621}
                          onChange={(e) => updateCfg({ modo_1621: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900"
                        >
                          <option value="historico">
                            Histórico (no usar como demanda del mes; pedir 1.6.2)
                          </option>
                          <option value="actual">
                            Actual (usar 1.6.2.1 como demanda del mes T2)
                          </option>
                        </select>
                        {cfg.modo_1621 === 'historico' && (
                          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(cfg.registrar_1621_historico)}
                              onChange={(e) =>
                                updateCfg({ registrar_1621_historico: e.target.checked })
                              }
                            />
                            Mostrar además 1.6.2.1 como nota histórica opcional
                          </label>
                        )}
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(cfg.usa_reactiva_obis)}
                            onChange={(e) => updateCfg({ usa_reactiva_obis: e.target.checked })}
                          />
                          Registrar Energía Reactiva Acumulada (kVARh)
                        </label>
                        {cfg.usa_reactiva_obis && (
                          <input
                            type="text"
                            value={cfg.codigo_reactiva || '3.8.0'}
                            onChange={(e) => updateCfg({ codigo_reactiva: e.target.value })}
                            placeholder="Código OBIS reactiva (ej. 3.8.0)"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-900"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN 2: CORTE DE FACTURACIÓN Y CALENDARIO HP / LABORABLE */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 block">
                2. Corte de Facturación y Calendario
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Día de corte (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={cfg.dia_corte}
                    onChange={(e) => updateCfg({ dia_corte: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Margen corte (±días)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={cfg.ventana_corte_dias}
                    onChange={(e) => updateCfg({ ventana_corte_dias: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-sm text-slate-900"
                  />
                </div>
                {meterForm.tipo === 'luz' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Inicio HP
                      </label>
                      <input
                        type="time"
                        value={cfg.hp_inicio || '18:00'}
                        onChange={(e) => updateCfg({ hp_inicio: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-300 font-mono text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Fin HP
                      </label>
                      <input
                        type="time"
                        value={cfg.hp_fin || '23:00'}
                        onChange={(e) => updateCfg({ hp_fin: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-xl bg-white border border-slate-300 font-mono text-sm text-slate-900"
                      />
                    </div>
                  </>
                )}
              </div>

              {meterForm.tipo === 'luz' && (
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg.excluir_domingos_hp)}
                      onChange={(e) => updateCfg({ excluir_domingos_hp: e.target.checked })}
                    />
                    Excluir domingos en HP
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg.excluir_feriados_hp)}
                      onChange={(e) => updateCfg({ excluir_feriados_hp: e.target.checked })}
                    />
                    Excluir feriados en HP (Perú + extra)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  Días laborables en la sede (para aviso de consumo cero):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((w) => {
                    const active = (cfg.dias_laborables || []).includes(w.day);
                    return (
                      <button
                        key={w.day}
                        type="button"
                        onClick={() => toggleWorkday(w.day)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                          active
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-500 border-slate-300'
                        }`}
                      >
                        {w.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Feriados locales adicionales (YYYY-MM-DD separados por coma):
                </label>
                <input
                  type="text"
                  value={meterForm.feriadosTexto}
                  onChange={(e) => setMeterForm({ ...meterForm, feriadosTexto: e.target.value })}
                  placeholder="Ej. 2026-10-15, 2026-11-27"
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-900"
                />
              </div>
            </div>

            {/* SECCIÓN 3: UMBRALES DE TODAS LAS ALERTAS */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 block">
                3. Umbrales Configurables de Alertas
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Desvío 4 sem. Ámbar (%)
                  </label>
                  <input
                    type="number"
                    value={cfg.umbrales?.consumo_ambar_pct ?? 20}
                    onChange={(e) => updateUmbral('consumo_ambar_pct', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Desvío 4 sem. Roja (%)
                  </label>
                  <input
                    type="number"
                    value={cfg.umbrales?.consumo_roja_pct ?? 40}
                    onChange={(e) => updateUmbral('consumo_roja_pct', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Salto confirmación (× prom)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={cfg.umbrales?.salto_confirmacion_multiplo ?? 3}
                    onChange={(e) => updateUmbral('salto_confirmacion_multiplo', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Sin lectura aviso (h)
                  </label>
                  <input
                    type="number"
                    value={cfg.umbrales?.horas_sin_lectura_aviso ?? 24}
                    onChange={(e) => updateUmbral('horas_sin_lectura_aviso', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              {meterForm.tipo === 'luz' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Demanda vs 5m Ámbar (%)
                    </label>
                    <input
                      type="number"
                      value={cfg.umbrales?.demanda_ambar_pct ?? 90}
                      onChange={(e) => updateUmbral('demanda_ambar_pct', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Reactiva Ámbar (%)
                    </label>
                    <input
                      type="number"
                      value={cfg.umbrales?.reactiva_ambar_pct ?? 27}
                      onChange={(e) => updateUmbral('reactiva_ambar_pct', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Reactiva Roja / Cobro (%)
                    </label>
                    <input
                      type="number"
                      value={cfg.umbrales?.reactiva_roja_pct ?? 30}
                      onChange={(e) => updateUmbral('reactiva_roja_pct', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Banda Calif. (ej. 0.45-0.55)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={cfg.umbrales?.calificacion_banda_min ?? 0.45}
                        onChange={(e) => updateUmbral('calificacion_banda_min', e.target.value)}
                        className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-slate-300 font-mono text-xs"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={cfg.umbrales?.calificacion_banda_max ?? 0.55}
                        onChange={(e) => updateUmbral('calificacion_banda_max', e.target.value)}
                        className="w-1/2 px-2 py-1.5 rounded-lg bg-white border border-slate-300 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMeterModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
              >
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
