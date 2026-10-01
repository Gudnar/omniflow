'use client';

import { Wrench } from 'lucide-react';

export function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
        <Wrench className="w-6 h-6 text-gray-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">{label}</h3>
      <p className="text-sm text-gray-500 max-w-sm">
        Esta sección está en construcción. Próximamente podrás configurar {label.toLowerCase()} desde aquí.
      </p>
    </div>
  );
}
