'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BranchSales {
  branchId: string;
  branchName: string;
  total: number;
}

export function SalesByBranch({ data }: { data: BranchSales[] }) {
  const router = useRouter();
  const chartData = data.map((d) => ({ branch: d.branchName, value: d.total }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-4">Ventas por Sucursal (7 días)</h3>

      {data.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center flex-1">Sin ventas en los últimos 7 días.</p>
      ) : (
        <div className="h-56 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="branch" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis
                tickFormatter={(v) => (v === 0 ? '0' : `${v / 1000}K`)}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                width={40}
              />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => [`Bs. ${Number(v).toLocaleString('es-BO')}`, 'Ventas']} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <button
        onClick={() => router.push('/dashboard/orders')}
        className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
      >
        Ver reporte completo <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
