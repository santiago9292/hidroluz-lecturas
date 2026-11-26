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
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center px-4 py-10">
      {/* Efectos ambientales de fondo */}
      <div className="pointer-events-none absolute -top-36 -left-24 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Identidad visual */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 shadow-2xl flex items-center justify-center mb-4">
            <div className="flex items-center -space-x-1.5">
              <Zap className="w-7 h-7 text-amber-400 fill-amber-400/25" />
              <Droplets className="w-7 h-7 text-sky-400 fill-sky-400/25" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            HidroLuz Control
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Registro inteligente de medidores de luz y agua en tiempo real
          </p>
        </div>

        {/* Tarjeta de acceso con DNI */}
        <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Ingreso Rápido con DNI</h2>
              <p className="text-xs text-slate-400">Sin contraseñas · Acceso directo a tu sede</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="dni-input" className="block text-xs font-medium text-slate-300 mb-1.5">
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
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/25 outline-none text-lg font-mono tracking-widest text-white placeholder:text-slate-600 transition"
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || dni.length < 4}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition cursor-pointer"
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
              className="mt-4 w-full py-2.5 px-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-400" />
              Instalar aplicación en {platform.name}
            </button>
          )}
        </div>

        {/* Accesos de demostración o referencia inicial */}
        {mode === 'demo' ? (
          <div className="mt-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 mb-3">
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
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {u.dni === '00000000' ? (
                      <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-slate-100">{u.label}</p>
                      <p className="text-[11px] text-slate-400">{u.sub}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-sky-300">
                    DNI {u.dni}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-5 text-center text-xs text-slate-500">
            Primer ingreso Sysadmin por defecto en BD nueva:{' '}
            <code className="text-slate-300 font-mono">00000000</code>
          </p>
        )}
      </div>
    </div>
  );
}
