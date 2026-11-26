import { X, ExternalLink } from 'lucide-react';

export default function MediaModal({ item, onClose }) {
  if (!item || !item.media_url) return null;

  const isVideo = item.media_tipo === 'video';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base">
              Evidencia de Lectura: {item.valor_lectura}{' '}
              {item.tipo === 'luz' ? 'kWh' : 'm³'}
            </h3>
            <p className="text-xs text-slate-400">
              Registrado por {item.usuario_nombre} (DNI {item.usuario_dni}) ·{' '}
              {new Date(item.fecha_lectura).toLocaleString('es-PE')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={item.media_url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
              title="Abrir original"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-hidden">
          {isVideo ? (
            <video
              src={item.media_url}
              controls
              autoPlay
              className="max-h-[72vh] w-full object-contain"
            />
          ) : (
            <img
              src={item.media_url}
              alt="Evidencia del medidor"
              className="max-h-[72vh] w-full object-contain"
            />
          )}
        </div>

        {item.observaciones && (
          <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-300">
            <strong>Observación:</strong> {item.observaciones}
          </div>
        )}
      </div>
    </div>
  );
}
