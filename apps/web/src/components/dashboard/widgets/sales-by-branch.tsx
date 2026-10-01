'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowRight } from 'lucide-react';

const data = [
  { branch: 'Centro', value: 95600 },
  { branch: 'Norte', value: 62300 },
  { branch: 'Sur', value: 48750 },
  { branch: 'Oeste', value: 39130 },
];

export function SalesByBranch() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-4">Ventas por Sucursal</h3>

      <div className="h-56 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="branch"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              tickFormatter={(v) => (v === 0 ? '0' : `${v / 1000}K`)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              width={40}
            />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              formatter={(v) => [`Bs. ${Number(v).toLocaleString('es-BO')}`, 'Ventas']}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={48}>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <button className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
        Ver reporte completo <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
