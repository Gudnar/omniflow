'use client';

import { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { apiUpload } from '@/lib/api-client';

// Lets the merchant either paste a URL directly (kept for parity with the
// old behavior — external images, CDN links) or upload a file straight to
// the API's local storage (see StorageService), which returns a URL that
// fills the same field. Reused for all 5 image fields in Apariencia.
export function ImageUploadField({
  label,
  value,
  onChange,
  token,
  endpoint = '/ecommerce/images',
}: {
  label: string;
  value: string | null | undefined;
  onChange: (url: string) => void;
  token: string | undefined;
  endpoint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiUpload<{ url: string }>(endpoint, token, formData);
      onChange(result.url);
    } catch (err: any) {
      setError(err.message ?? 'Error al subir la imagen');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <div className="w-11 h-11 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[8px] text-gray-300 text-center leading-tight">Sin imagen</span>
          )}
        </div>
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... o sube un archivo"
          className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Subir
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} className="shrink-0 p-2 text-gray-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
