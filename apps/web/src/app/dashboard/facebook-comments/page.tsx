'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Send, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { FacebookPost, FacebookComment } from '@/lib/types';

function CommentRow({
  comment,
  isReply,
  onReply,
}: {
  comment: FacebookComment;
  isReply: boolean;
  onReply: (comment: FacebookComment, message: string) => Promise<void>;
}) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const isOutbound = comment.direction === 'OUTBOUND';

  const submit = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await onReply(comment, replyText);
      setReplyText('');
      setShowReplyBox(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`${isReply ? 'ml-8' : ''}`}>
      <div className={`rounded-lg px-3 py-2 text-sm ${isOutbound ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-gray-700">
            {isOutbound ? 'Tu Página' : comment.authorName || comment.authorExternalId || 'Usuario'}
          </span>
          <span className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-gray-800">{comment.message}</p>
      </div>

      {!isOutbound && (
        <div className="mt-1">
          {showReplyBox ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Escribe una respuesta pública..."
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                autoFocus
              />
              <button
                onClick={submit}
                disabled={sending || !replyText.trim()}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowReplyBox(false)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowReplyBox(true)}
              className="text-xs font-medium text-blue-600 hover:underline mt-0.5"
            >
              Responder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onChanged }: { post: FacebookPost; onChanged: () => void }) {
  const { tokens } = useAuth();
  const toast = useToast();

  const reply = async (comment: FacebookComment, message: string) => {
    try {
      await apiPost(`/facebook-comments/${comment.id}/reply`, tokens?.accessToken, { message });
      onChanged();
      toast.success('Respuesta enviada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo enviar la respuesta');
    }
  };

  const topLevel = post.comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => post.comments.filter((c) => c.parentId === id);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-800 flex-1">{post.message || <span className="text-gray-400 italic">Sin texto</span>}</p>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
          >
            Ver publicación <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-100">
        {topLevel.length === 0 && <p className="text-sm text-gray-400">Sin comentarios todavía.</p>}
        {topLevel.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <CommentRow comment={comment} isReply={false} onReply={reply} />
            {repliesOf(comment.id).map((reply_) => (
              <CommentRow key={reply_.id} comment={reply_} isReply onReply={reply} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FacebookCommentsPage() {
  const router = useRouter();
  const { user, isLoading, tokens } = useAuth();
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = () => apiGet<FacebookPost[]>('/facebook-comments/posts', tokens?.accessToken).then(setPosts);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching Facebook posts/comments:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Comentarios</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Responde comentarios de las publicaciones de tu Página de Facebook. Conecta la Página desde Configuración →
          Integraciones → Canales.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
          <MessageCircle className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Aún no hay comentarios. Aparecerán aquí en cuanto lleguen.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onChanged={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
