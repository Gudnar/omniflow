'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  changePct: number | null;
  sparklineColor: string;
  sparklineData: number[];
}

export function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  changePct,
  sparklineColor,
  sparklineData,
}: StatCardProps) {
  const data = sparklineData.map((v, i) => ({ i, v }));
  const isDown = changePct !== null && changePct < 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-500 truncate">{label}</p>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        </div>
      </div>

      <div className={`flex items-center gap-1 text-xs font-semibold mb-2 ${isDown ? 'text-red-600' : 'text-emerald-600'}`}>
        {changePct === null ? (
          <span className="text-gray-400 font-normal">Sin datos de la semana anterior</span>
        ) : (
          <>
            {isDown ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
            <span>{Math.abs(changePct)}%</span>
            <span className="text-gray-400 font-normal">vs semana anterior</span>
          </>
        )}
      </div>

      <div className="h-10 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={sparklineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={sparklineColor}
              strokeWidth={2}
              fill={`url(#grad-${label})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
