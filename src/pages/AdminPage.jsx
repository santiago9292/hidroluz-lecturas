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
import { DEFAULT_TRIFASICO_CODES } from '@/lib/obis';
import { resetDemoDb } from '@/lib/demoData';

export default function AdminPage() {
  const { mode, currentUser, sedes, meters, users, refreshData, showToast } = useApp();

  const [activeTab, setActiveTab] = useState('usuarios');
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
    umbralLuz: 180,
    umbralAgua: 25,
    luzTrifasico: true,
  });

  const [meterModalOpen, setMeterModalOpen] = useState(false);
  const [meterForm, setMeterForm] = useState({
    id: null,
    sede_id: '',
    tipo: 'luz',
    nombre: '',
    numero_serie: '',
    umbral_diario_max: 180,
    porcentaje_alerta_promedio: 30,
    es_trifasico: false,
    codigos_obis: DEFAULT_TRIFASICO_CODES,
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
      umbralLuz: 180,
      umbralAgua: 25,
      luzTrifasico: true,
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
      umbralLuz: 180,
      umbralAgua: 25,
      luzTrifasico: false,
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
          : 'Sede creada con sus medidores de luz y agua.',
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
    setMeterForm({
      id: null,
      sede_id: sedeId,
      tipo: 'luz',
      nombre: 'Medidor Trifásico Luz',
      numero_serie: '',
      umbral_diario_max: 180,
      porcentaje_alerta_promedio: 30,
      es_trifasico: true,
      codigos_obis: DEFAULT_TRIFASICO_CODES.map((c) => ({ ...c })),
      activo: true,
    });
    setMeterModalOpen(true);
  };

  const openEditMeter = (m) => {
    setMeterForm({
      id: m.id,
      sede_id: m.sede_id,
      tipo: m.tipo,
      nombre: m.nombre,
      numero_serie: m.numero_serie || '',
      umbral_diario_max: m.umbral_diario_max ?? '',
      porcentaje_alerta_promedio: m.porcentaje_alerta_promedio ?? 30,
      es_trifasico: Boolean(m.es_trifasico),
      codigos_obis:
        Array.isArray(m.codigos_obis) && m.codigos_obis.length > 0
          ? m.codigos_obis.map((c) => ({ ...c }))
          : DEFAULT_TRIFASICO_CODES.map((c) => ({ ...c })),
      activo: m.activo,
    });
    setMeterModalOpen(true);
  };

  const updateObisCodeRow = (index, field, value) => {
    setMeterForm((prev) => {
      const next = [...prev.codigos_obis];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, codigos_obis: next };
    });
  };

  const addObisCodeRow = () => {
    setMeterForm((prev) => ({
      ...prev,
      codigos_obis: [
        ...prev.codigos_obis,
        { code: '', label: 'Código extra', unit: 'kWh', sumaConsumo: false },
      ],
    }));
  };

  const removeObisCodeRow = (index) => {
    setMeterForm((prev) => ({
      ...prev,
      codigos_obis: prev.codigos_obis.filter((_, i) => i !== index),
    }));
  };

  const handleSaveMeter = async (e) => {
    e.preventDefault();
    try {
      await saveMeterAdmin(meterForm);
      await refreshData(true);
      setMeterModalOpen(false);
      showToast('Configuración de medidor guardada.', 'success');
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
    return (
      u.dni.toLowerCase().includes(q) ||
      u.nombre_completo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            Administración del Sistema (Sysadmin)
          </h2>
          <p className="text-sm text-slate-500">
            Gestiona usuarios por DNI, sedes y medidores Monofásicos o Trifásicos (códigos OBIS).
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
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'usuarios'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" /> Usuarios ({users.length})
        </button>
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
      </div>

      {/* PESTAÑA 1: GESTIÓN DE USUARIOS */}
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
                              title="Editar usuario"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                title="Eliminar usuario"
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

      {/* PESTAÑA 2: GESTIÓN DE SEDES Y SUS MEDIDORES */}
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

                  {/* Lista de medidores */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5" /> Medidores y Umbrales ({sedeMeters.length})
                      </span>
                      <button
                        onClick={() => openNewMeter(sede.id)}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar medidor
                      </button>
                    </div>

                    {sedeMeters.map((m) => (
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
                              {m.es_trifasico && (
                                <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                                  Trifásico ({(m.codigos_obis || []).map((c) => c.code).join(', ')})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Máx diario:{' '}
                              <strong className="text-slate-700">
                                {m.umbral_diario_max
                                  ? `${m.umbral_diario_max} ${m.unidad}/día`
                                  : 'Sin tope fijo'}
                              </strong>{' '}
                              · Alerta prom: +{m.porcentaje_alerta_promedio}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditMeter(m)}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 cursor-pointer"
                            title="Configurar medidor / Trifásico"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMeter(m)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR USUARIO */}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                DNI de acceso *
              </label>
              <input
                type="text"
                required
                maxLength={15}
                value={userForm.dni}
                onChange={(e) =>
                  setUserForm({ ...userForm, dni: e.target.value.replace(/[^0-9A-Za-z]/g, '') })
                }
                placeholder="Ej. 72849102"
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
                placeholder="Ej. María Fernández"
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

      {/* MODAL CREAR / EDITAR SEDE */}
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
                  placeholder="Lima"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={sedeForm.direccion}
                  onChange={(e) => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                  placeholder="Av. Principal"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                />
              </div>
            </div>

            {!sedeForm.id && (
              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
                <p className="text-xs font-bold text-sky-900">
                  Configuración inicial de medidores:
                </p>

                <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-700">
                    Tipo de Medidor Eléctrico
                  </span>
                  <select
                    value={sedeForm.luzTrifasico ? 'trifasico' : 'monofasico'}
                    onChange={(e) =>
                      setSedeForm({
                        ...sedeForm,
                        luzTrifasico: e.target.value === 'trifasico',
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900"
                  >
                    <option value="trifasico">Trifásico (1.8.1, 1.8.2, 1.6.1, 1.6.2.1)</option>
                    <option value="monofasico">Monofásico (1 lectura)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Máx. Luz (kWh/día)
                    </label>
                    <input
                      type="number"
                      value={sedeForm.umbralLuz}
                      onChange={(e) => setSedeForm({ ...sedeForm, umbralLuz: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Máx. Agua (m³/día)
                    </label>
                    <input
                      type="number"
                      value={sedeForm.umbralAgua}
                      onChange={(e) => setSedeForm({ ...sedeForm, umbralAgua: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm"
                    />
                  </div>
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

      {/* MODAL CREAR / EDITAR MEDIDOR (CON CONFIGURADOR TRIFÁSICO OBIS) */}
      {meterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveMeter}
            className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">
                {meterForm.id ? 'Configurar Medidor' : 'Agregar Medidor'}
              </h3>
              <button
                type="button"
                onClick={() => setMeterModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Servicio</label>
                <select
                  value={meterForm.tipo}
                  onChange={(e) =>
                    setMeterForm({
                      ...meterForm,
                      tipo: e.target.value,
                      es_trifasico: e.target.value === 'luz' ? meterForm.es_trifasico : false,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
                >
                  <option value="luz">Luz (kWh)</option>
                  <option value="agua">Agua (m³)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">N° Serie</label>
                <input
                  type="text"
                  value={meterForm.numero_serie}
                  onChange={(e) => setMeterForm({ ...meterForm, numero_serie: e.target.value })}
                  placeholder="Ej. MED-209"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm"
                />
              </div>
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm"
              />
            </div>

            {/* Selector Monofásico vs Trifásico */}
            {meterForm.tipo === 'luz' && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Modo del Medidor Eléctrico
                    </span>
                  </div>
                  <div className="inline-flex rounded-xl bg-white border border-slate-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => setMeterForm({ ...meterForm, es_trifasico: false })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        !meterForm.es_trifasico
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      Monofásico
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeterForm({ ...meterForm, es_trifasico: true })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        meterForm.es_trifasico
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      Trifásico (OBIS)
                    </button>
                  </div>
                </div>

                {meterForm.es_trifasico && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-600">
                        Códigos registrados (marca &ldquo;Suma kWh&rdquo; para energía activa):
                      </span>
                      <button
                        type="button"
                        onClick={addObisCodeRow}
                        className="text-[11px] font-bold text-indigo-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Código
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {meterForm.codigos_obis.map((c, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-1.5 items-center bg-white p-2 rounded-xl border border-slate-200"
                        >
                          <input
                            type="text"
                            required
                            placeholder="1.8.1"
                            value={c.code}
                            onChange={(e) => updateObisCodeRow(idx, 'code', e.target.value)}
                            className="col-span-3 px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-slate-900"
                          />
                          <input
                            type="text"
                            placeholder="Etiqueta"
                            value={c.label}
                            onChange={(e) => updateObisCodeRow(idx, 'label', e.target.value)}
                            className="col-span-5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800"
                          />
                          <label className="col-span-3 flex items-center gap-1 text-[10px] font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={c.sumaConsumo !== false}
                              onChange={(e) =>
                                updateObisCodeRow(idx, 'sumaConsumo', e.target.checked)
                              }
                              className="rounded border-slate-300"
                            />
                            Suma kWh
                          </label>
                          <button
                            type="button"
                            disabled={meterForm.codigos_obis.length <= 1}
                            onClick={() => removeObisCodeRow(idx)}
                            className="col-span-1 text-rose-500 hover:text-rose-700 disabled:opacity-30 flex justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Umbral Diario Máx ({meterForm.tipo === 'luz' ? 'kWh' : 'm³'}/día)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={meterForm.umbral_diario_max}
                  onChange={(e) =>
                    setMeterForm({ ...meterForm, umbral_diario_max: e.target.value })
                  }
                  placeholder="Vacío = sin límite fijo"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  % Alerta s/Promedio
                </label>
                <input
                  type="number"
                  value={meterForm.porcentaje_alerta_promedio}
                  onChange={(e) =>
                    setMeterForm({ ...meterForm, porcentaje_alerta_promedio: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm"
                />
              </div>
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
                Guardar Medidor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
