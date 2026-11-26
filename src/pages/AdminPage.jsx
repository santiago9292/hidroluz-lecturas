import { useState } from 'react';
import {
  Building2,
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
import { resetDemoDb } from '@/lib/demoData';

export default function AdminPage() {
  const { mode, currentUser, sedes, meters, users, refreshData, showToast } = useApp();

  const [activeTab, setActiveTab] = useState('usuarios');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Usuario
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    id: null,
    dni: '',
    nombre_completo: '',
    rol: 'operario',
    sede_id: '',
    activo: true,
  });

  // Modal Sede
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
  });

  // Modal Medidor
  const [meterModalOpen, setMeterModalOpen] = useState(false);
  const [meterForm, setMeterForm] = useState({
    id: null,
    sede_id: '',
    tipo: 'luz',
    nombre: '',
    numero_serie: '',
    umbral_diario_max: 180,
    porcentaje_alerta_promedio: 30,
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
      nombre: 'Medidor Adicional Luz',
      numero_serie: '',
      umbral_diario_max: 150,
      porcentaje_alerta_promedio: 30,
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
      activo: m.activo,
    });
    setMeterModalOpen(true);
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
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            Administración del Sistema (Sysadmin)
          </h2>
          <p className="text-sm text-slate-400">
            Gestiona usuarios por DNI, crea sedes, asigna personal y calibra umbrales de alerta.
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
            className="self-start px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Demo
          </button>
        )}
      </div>

      {/* Pestañas: Usuarios vs Sedes y Medidores */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'usuarios'
              ? 'bg-sky-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" /> Usuarios ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('sedes')}
          className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'sedes'
              ? 'bg-sky-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 hover:text-white'
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
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar usuario por DNI o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 focus:border-sky-400 outline-none text-sm text-white"
              />
            </div>
            <button
              onClick={openNewUser}
              className="px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Nuevo Usuario con DNI
            </button>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 bg-slate-950/40">
                    <th className="py-3.5 px-5">DNI</th>
                    <th className="py-3.5 px-4">Nombre Completo</th>
                    <th className="py-3.5 px-4">Rol</th>
                    <th className="py-3.5 px-4">Sede Asignada</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredUsers.map((u) => {
                    const userSede = sedes.find((s) => s.id === u.sede_id);
                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30">
                        <td className="py-3.5 px-5 font-mono font-bold text-sky-300">{u.dni}</td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {u.nombre_completo}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              u.rol === 'sysadmin'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.rol === 'sysadmin' ? 'Sysadmin' : 'Operario'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {u.rol === 'sysadmin'
                            ? 'Todas las sedes'
                            : userSede?.nombre || 'Sin asignar'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              u.activo
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEditUser(u)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                              title="Editar usuario"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
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
              className="px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center gap-2 cursor-pointer"
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
                  className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-white">{sede.nombre}</h3>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 font-mono text-xs text-sky-300">
                          {sede.codigo}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {sede.direccion || 'Sin dirección'} {sede.ciudad ? `· ${sede.ciudad}` : ''}{' '}
                        · {assignedCount} operario(s)
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditSede(sede)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                        title="Editar sede"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSede(sede)}
                        className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                        title="Eliminar sede"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Lista de medidores de la sede */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5" /> Medidores y Umbrales ({sedeMeters.length})
                      </span>
                      <button
                        onClick={() => openNewMeter(sede.id)}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar medidor
                      </button>
                    </div>

                    {sedeMeters.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {m.tipo === 'luz' ? (
                            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{m.nombre}</p>
                            <p className="text-[11px] text-slate-400">
                              Máx diario:{' '}
                              <strong>
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
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMeter(m)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveUser}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">
                {userForm.id ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={userForm.nombre_completo}
                onChange={(e) => setUserForm({ ...userForm, nombre_completo: e.target.value })}
                placeholder="Ej. María Fernández"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rol</label>
                <select
                  value={userForm.rol}
                  onChange={(e) => setUserForm({ ...userForm, rol: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value="operario">Operario de Sede</option>
                  <option value="sysadmin">Sysadmin Global</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Estado</label>
                <select
                  value={userForm.activo ? 'true' : 'false'}
                  onChange={(e) =>
                    setUserForm({ ...userForm, activo: e.target.value === 'true' })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>

            {userForm.rol === 'operario' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sede Asignada (Solo podrá registrar en esta sede) *
                </label>
                <select
                  required
                  value={userForm.sede_id}
                  onChange={(e) => setUserForm({ ...userForm, sede_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
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
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Guardar Usuario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CREAR / EDITAR SEDE */}
      {sedeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSede}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">
                {sedeForm.id ? 'Editar Sede' : 'Nueva Sede'}
              </h3>
              <button
                type="button"
                onClick={() => setSedeModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre de Sede *
                </label>
                <input
                  type="text"
                  required
                  value={sedeForm.nombre}
                  onChange={(e) => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                  placeholder="Ej. Sede Callao"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Código *</label>
                <input
                  type="text"
                  required
                  value={sedeForm.codigo}
                  onChange={(e) =>
                    setSedeForm({ ...sedeForm, codigo: e.target.value.toUpperCase() })
                  }
                  placeholder="CAL-04"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ciudad</label>
                <input
                  type="text"
                  value={sedeForm.ciudad}
                  onChange={(e) => setSedeForm({ ...sedeForm, ciudad: e.target.value })}
                  placeholder="Lima"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Dirección</label>
                <input
                  type="text"
                  value={sedeForm.direccion}
                  onChange={(e) => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                  placeholder="Av. Argentina 1200"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>
            </div>

            {!sedeForm.id && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <p className="text-xs font-semibold text-sky-300">
                  Umbrales diarios iniciales (crea medidor de Luz y Agua automáticamente):
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Máx. Luz (kWh/día)
                    </label>
                    <input
                      type="number"
                      value={sedeForm.umbralLuz}
                      onChange={(e) => setSedeForm({ ...sedeForm, umbralLuz: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Máx. Agua (m³/día)
                    </label>
                    <input
                      type="number"
                      value={sedeForm.umbralAgua}
                      onChange={(e) => setSedeForm({ ...sedeForm, umbralAgua: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSedeModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Guardar Sede
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CREAR / EDITAR MEDIDOR */}
      {meterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveMeter}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">
                {meterForm.id ? 'Configurar Medidor' : 'Agregar Medidor'}
              </h3>
              <button
                type="button"
                onClick={() => setMeterModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Servicio</label>
                <select
                  value={meterForm.tipo}
                  onChange={(e) => setMeterForm({ ...meterForm, tipo: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value="luz">Luz (kWh)</option>
                  <option value="agua">Agua (m³)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">N° Serie</label>
                <input
                  type="text"
                  value={meterForm.numero_serie}
                  onChange={(e) => setMeterForm({ ...meterForm, numero_serie: e.target.value })}
                  placeholder="Ej. MED-209"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre del Medidor *
              </label>
              <input
                type="text"
                required
                value={meterForm.nombre}
                onChange={(e) => setMeterForm({ ...meterForm, nombre: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
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
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  % Alerta s/Promedio
                </label>
                <input
                  type="number"
                  value={meterForm.porcentaje_alerta_promedio}
                  onChange={(e) =>
                    setMeterForm({ ...meterForm, porcentaje_alerta_promedio: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMeterModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
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
