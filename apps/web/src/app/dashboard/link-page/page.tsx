'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LinkPageEditor } from '@/components/link-page/link-page-editor';

export default function LinkPagePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Página de Enlaces</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Una página pública tipo Linktree para compartir en tu bio: avatar, título, bio y una lista de enlaces.
        </p>
      </div>

      <LinkPageEditor />
    </div>
  );
}
