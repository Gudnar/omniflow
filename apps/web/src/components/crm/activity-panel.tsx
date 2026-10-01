'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Mail, CalendarCheck, Phone, ClipboardList, HelpCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { Note, Activity, ActivityType } from '@/lib/types';

const ACTIVITY_ICONS: Record<ActivityType, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; bg: string; color: string }> = {
  CALL: { icon: Phone, bg: '#dbeafe', color: '#2563eb' },
  EMAIL: { icon: Mail, bg: '#dbeafe', color: '#2563eb' },
  MEETING: { icon: CalendarCheck, bg: '#fef3c7', color: '#d97706' },
  WHATSAPP: { icon: MessageCircle, bg: '#dcfce7', color: '#16a34a' },
  TASK: { icon: ClipboardList, bg: '#ede9fe', color: '#7c3aed' },
  OTHER: { icon: HelpCircle, bg: '#f3f4f6', color: '#6b7280' },
};

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: 'Llamada',
  EMAIL: 'Email',
  MEETING: 'Reunión',
  WHATSAPP: 'WhatsApp',
  TASK: 'Tarea',
  OTHER: 'Otro',
};

export function ActivityPanel({ contactId }: { contactId: string | null }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'activity' | 'notes'>('activity');
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [noteText, setNoteText] = useState('');
  const [activityForm, setActivityForm] = useState({ type: 'CALL' as ActivityType, subject: '' });

  useEffect(() => {
    if (!contactId) return;
    apiGet<Note[]>(`/contacts/${contactId}/notes`, tokens?.accessToken).then(setNotes).catch(console.error);
    apiGet<Activity[]>(`/contacts/${contactId}/activities`, tokens?.accessToken).then(setActivities).catch(console.error);
  }, [contactId, tokens]);

  const addNote = async () => {
    if (!contactId || !noteText.trim()) return;
    try {
      const created = await apiPost<Note>(`/contacts/${contactId}/notes`, tokens?.accessToken, { body: noteText });
      setNotes((prev) => [created, ...prev]);
      setNoteText('');
      toast.success('Nota agregada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar la nota');
    }
  };

  const addActivity = async () => {
    if (!contactId || !activityForm.subject.trim()) return;
    try {
      const created = await apiPost<Activity>(`/contacts/${contactId}/activities`, tokens?.accessToken, activityForm);
      setActivities((prev) => [created, ...prev]);
      setActivityForm({ type: 'CALL', subject: '' });
      toast.success('Actividad agregada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar la actividad');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-5">
        <button
          onClick={() => setTab('activity')}
          className={`flex items-center gap-1.5 px-3 py-3.5 text-sm font-medium border-b-2 transition ${
            tab === 'activity' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Actividad
          <span className="text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center bg-gray-100 text-gray-600">
            {activities.length}
          </span>
        </button>
        <button
          onClick={() => setTab('notes')}
          className={`flex items-center gap-1.5 px-3 py-3.5 text-sm font-medium border-b-2 transition ${
            tab === 'notes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Notas
          <span className="text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center bg-gray-100 text-gray-600">
            {notes.length}
          </span>
        </button>
      </div>

      <div className="p-5">
        {tab === 'notes' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Escribe una nota..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addNote}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition shrink-0"
              >
                Agregar nota
              </button>
            </div>
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-800">{note.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(note.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-sm text-gray-400">Sin notas todavía.</p>}
            </div>
          </>
        )}

        {tab === 'activity' && (
          <>
            <div className="flex items-center gap-2 mb-6">
              <select
                value={activityForm.type}
                onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as ActivityType })}
                className="px-2 py-2.5 border border-gray-200 rounded-lg text-sm shrink-0"
              >
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={activityForm.subject}
                onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
                placeholder="Asunto..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addActivity}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition shrink-0"
              >
                Agregar
              </button>
            </div>

            <h4 className="text-sm font-bold text-gray-900 mb-4">Timeline</h4>
            <div className="space-y-5">
              {activities.map((event) => {
                const cfg = ACTIVITY_ICONS[event.type];
                const Icon = cfg.icon;
                return (
                  <div key={event.id} className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{event.subject}</p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(event.occurredAt).toLocaleString()}
                        </span>
                      </div>
                      {event.description && <p className="text-sm text-gray-600 mt-0.5">{event.description}</p>}
                    </div>
                  </div>
                );
              })}
              {activities.length === 0 && <p className="text-sm text-gray-400">Sin actividad registrada.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
