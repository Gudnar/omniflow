'use client';

const stages = [
  { label: 'Leads Nuevos', value: 1250, pct: null, color: '#1e3a8a', width: 100 },
  { label: 'Contactados', value: 820, pct: '65.6%', color: '#16a34a', width: 80 },
  { label: 'Calificados', value: 480, pct: '58.5%', color: '#4ade80', width: 60 },
  { label: 'Propuestas', value: 250, pct: '52.1%', color: '#fb923c', width: 40 },
  { label: 'Ganados', value: 142, pct: '56.8%', color: '#ec4899', width: 24 },
];

export function SalesFunnel() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <h3 className="font-semibold text-gray-900 mb-4">Embudo de Ventas</h3>
      <div className="flex gap-4">
        <div className="flex-1 flex flex-col items-center gap-1 py-1">
          {stages.map((s) => (
            <div
              key={s.label}
              className="h-9 flex items-center justify-center text-white text-xs font-semibold rounded-sm"
              style={{ backgroundColor: s.color, width: `${s.width}%` }}
            >
              {s.value.toLocaleString('es-BO')}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 py-1 shrink-0">
          {stages.map((s) => (
            <div key={s.label} className="h-9 flex flex-col justify-center">
              <p className="text-sm font-medium text-gray-800 leading-tight">{s.label}</p>
              {s.pct && <p className="text-xs text-gray-400 leading-tight">{s.pct}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
