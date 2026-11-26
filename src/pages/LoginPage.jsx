import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Download,
  Droplets,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { detectPlatformInfo } from '@/lib/pushClient';

export default function LoginPage() {
  const { login, mode, promptInstallApp } = useApp();
  const navigate = useNavigate();

  const [dni, setDni] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const platform = detectPlatformInfo();

  const handleSubmit = async (e, overrideDni) => {
    if (e) e.preventDefault();
    const targetDni = overrideDni ?? dni;
    setError('');
    setSubmitting(true);
    try {
      await login(targetDni);
      navigate('/registro');
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickDemoUsers = [
    { dni: '00000000', label: 'Sysadmin Global', sub: 'Todas las sedes + Admin' },
    { dni: '12345678', label: 'Operario Lima', sub: 'Sede Central Miraflores' },
    { dni: '87654321', label: 'Operario Trujillo', sub: 'Planta Industrial Norte' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-50 to-amber-50/50 relative overflow-hidden flex flex-col items-center justify-center px-4 py-10">
      {/* Efectos ambientales suaves */}
      <div className="pointer-events-none absolute -top-36 -left-24 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Identidad visual */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-white border border-slate-200 shadow-lg shadow-slate-200/70 flex items-center justify-center mb-4">
            <div className="flex items-center -space-x-1.5">
              <Zap className="w-7 h-7 text-amber-500 fill-amber-400/25" />
              <Droplets className="w-7 h-7 text-sky-600 fill-sky-400/25" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            HidroLuz Control
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Registro inteligente de medidores de luz y agua en tiempo real
          </p>
        </div>

        {/* Tarjeta de acceso con DNI */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Ingreso Rápido con DNI</h2>
              <p className="text-xs text-slate-500">Sin contraseñas · Acceso directo a tu sede</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="dni-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Número de DNI
              </label>
              <input
                id="dni-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={15}
                placeholder="Ej. 12345678"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 outline-none text-lg font-mono tracking-widest text-slate-900 placeholder:text-slate-400 transition"
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || dni.length < 4}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 transition cursor-pointer"
            >
              <span>{submitting ? 'Verificando DNI...' : 'Ingresar al Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Instalación PWA rápida en Android / iOS / Escritorio */}
          {!platform.isStandalone && (
            <button
              type="button"
              onClick={promptInstallApp}
              className="mt-4 w-full py-2.5 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-600" />
              Instalar aplicación en {platform.name}
            </button>
          )}
        </div>

        {/* Accesos de demostración o referencia inicial */}
        {mode === 'demo' ? (
          <div className="mt-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 mb-3">
              <Sparkles className="w-4 h-4" />
              <span>Acceso rápido en Modo Demo (clic para probar cada rol)</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {quickDemoUsers.map((u) => (
                <button
                  key={u.dni}
                  type="button"
                  onClick={() => {
                    setDni(u.dni);
                    handleSubmit(null, u.dni);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {u.dni === '00000000' ? (
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-sky-600 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-900">{u.label}</p>
                      <p className="text-[11px] text-slate-500">{u.sub}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-sky-700">
                    DNI {u.dni}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-5 text-center text-xs text-slate-500">
            Acceso rápido autorizado mediante DNI registrado por el administrador.
          </p>
        )}
      </div>
    </div>
  );
}
