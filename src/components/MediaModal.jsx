import { X, ExternalLink } from 'lucide-react';
import { formatAguaNumber, formatLuzNumber } from '@/lib/obis';

export default function MediaModal({ item, onClose }) {
  if (!item || !item.media_url) return null;

  const isVideo = item.media_tipo === 'video';
  const isLuz = item.tipo === 'luz';
  const obisEntries = item.lecturas_obis ? Object.entries(item.lecturas_obis) : [];
  const rawDisplay = isLuz
    ? formatLuzNumber(item.calculos?.consumoTotal ?? item.consumo_total_periodo ?? item.valor_lectura)
    : formatAguaNumber(item.valor_crudo ?? item.valor_lectura);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl"
      >
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Evidencia: {isLuz ? `Δ ${rawDisplay} kWh` : `${rawDisplay} m³`}
            </h3>
            <p className="text-xs text-slate-500">
              {item.usuario_nombre} (DNI {item.usuario_dni}) ·{' '}
              {new Date(item.fecha_lectura).toLocaleString('es-PE')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={item.media_url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 transition"
              title="Abrir original"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {obisEntries.length > 0 && (
          <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-200/70 flex flex-wrap gap-1.5">
            {obisEntries.map(([code, val]) => (
              <span
                key={code}
                className="px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-[11px] font-mono font-bold text-slate-800"
              >
                {code}: {formatLuzNumber(val)}
              </span>
            ))}
          </div>
        )}

        <div className="bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-hidden">
          {isVideo ? (
            <video
              src={item.media_url}
              controls
              autoPlay
              className="max-h-[68vh] w-full object-contain"
            />
          ) : (
            <img
              src={item.media_url}
              alt="Evidencia del medidor"
              className="max-h-[68vh] w-full object-contain"
            />
          )}
        </div>

        {item.observaciones && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-700">
            <strong>Observación:</strong> {item.observaciones}
          </div>
        )}
      </div>
    </div>
  );
}
