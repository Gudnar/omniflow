'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import type { FlowNodeType } from '@/lib/types';

export const EVENT_TYPES = [
  'contact.created',
  'contact.tag_added',
  'message.received',
  'cart.abandoned',
  'order.created',
  'order.confirmed',
  'order.cancelled',
  'order.delivered',
  'appointment.created',
  'appointment.confirmed',
  'appointment.cancelled',
  'appointment.completed',
  'appointment.no_show',
  'order.pending_approval',
  'appointment.pending_approval',
];

export const ACTION_SUBTYPES = [
  'SEND_MESSAGE',
  'ADD_NOTE',
  'ADD_TAG',
  'REMOVE_TAG',
  'ASSIGN_CONVERSATION',
  'UPDATE_ORDER_STATUS',
  'UPDATE_APPOINTMENT_STATUS',
  'WEBHOOK_CALL',
  'NOTIFY',
] as const;

const ACTION_LABELS: Record<string, string> = {
  SEND_MESSAGE: 'Enviar mensaje',
  ADD_NOTE: 'Agregar nota',
  ADD_TAG: 'Agregar etiqueta',
  REMOVE_TAG: 'Quitar etiqueta',
  ASSIGN_CONVERSATION: 'Asignar conversación',
  UPDATE_ORDER_STATUS: 'Cambiar estado de pedido',
  UPDATE_APPOINTMENT_STATUS: 'Cambiar estado de cita',
  WEBHOOK_CALL: 'Llamar webhook',
  NOTIFY: 'Notificar al equipo',
};

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
const APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export interface NodeFormValue {
  subtype: string;
  name?: string;
  config: Record<string, any>;
}

export function NodeConfigModal({
  open,
  nodeType,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  nodeType: FlowNodeType;
  initial: NodeFormValue;
  onClose: () => void;
  onSave: (value: NodeFormValue) => void;
  onDelete: () => void;
}) {
  const [subtype, setSubtype] = useState(initial.subtype);
  const [config, setConfig] = useState<Record<string, any>>(initial.config ?? {});

  useEffect(() => {
    setSubtype(initial.subtype);
    setConfig(initial.config ?? {});
  }, [initial]);

  const set = (key: string, value: any) => setConfig((c) => ({ ...c, [key]: value }));

  const title =
    nodeType === 'TRIGGER'
      ? 'Configurar disparador'
      : nodeType === 'CONDITION'
        ? 'Configurar condición'
        : nodeType === 'WAIT'
          ? 'Configurar espera'
          : 'Configurar acción';

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {nodeType === 'TRIGGER' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Tipo de disparador</label>
              <select
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="EVENT">Evento</option>
                <option value="SCHEDULE">Horario (cron)</option>
                <option value="MANUAL">Manual (solo pruebas)</option>
              </select>
            </div>
            {subtype === 'EVENT' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Evento</label>
                <select
                  value={config.eventType ?? ''}
                  onChange={(e) => set('eventType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">—</option>
                  {EVENT_TYPES.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            )}
            {subtype === 'SCHEDULE' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Expresión cron</label>
                <input
                  value={config.cron ?? ''}
                  onChange={(e) => set('cron', e.target.value)}
                  placeholder="*/5 * * * *"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>
            )}
          </>
        )}

        {nodeType === 'CONDITION' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Campo</label>
              <input
                value={config.field ?? ''}
                onChange={(e) => set('field', e.target.value)}
                placeholder="event.payload.tagName / contact.tags"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Operador</label>
              <select
                value={config.operator ?? 'eq'}
                onChange={(e) => set('operator', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="eq">es igual a</option>
                <option value="neq">es distinto de</option>
                <option value="contains">contiene</option>
                <option value="gt">es mayor que</option>
                <option value="lt">es menor que</option>
                <option value="exists">existe</option>
              </select>
            </div>
            {config.operator !== 'exists' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Valor</label>
                <input
                  value={config.value ?? ''}
                  onChange={(e) => set('value', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}
            <p className="text-xs text-gray-400">
              La rama <span className="font-semibold text-emerald-600">Sí</span> sale por el conector superior derecho, la{' '}
              <span className="font-semibold text-red-500">No</span> por el inferior.
            </p>
          </>
        )}

        {nodeType === 'WAIT' && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Minutos de espera</label>
            <input
              type="number"
              step="0.1"
              value={config.delayMinutes ?? ''}
              onChange={(e) => set('delayMinutes', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        )}

        {nodeType === 'ACTION' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Acción</label>
              <select
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {ACTION_SUBTYPES.map((s) => (
                  <option key={s} value={s}>{ACTION_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {subtype === 'SEND_MESSAGE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de conversación</label>
                  <input value={config.conversationId ?? ''} onChange={(e) => set('conversationId', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Contenido</label>
                  <textarea value={config.content ?? ''} onChange={(e) => set('content', e.target.value)} rows={2} placeholder="Hola {{contact.name}}..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </>
            )}

            {subtype === 'ADD_NOTE' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Texto de la nota</label>
                <textarea value={config.body ?? ''} onChange={(e) => set('body', e.target.value)} rows={2} placeholder="Cliente etiquetado como {{event.payload.tagName}}" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            )}

            {(subtype === 'ADD_TAG' || subtype === 'REMOVE_TAG') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de etiqueta</label>
                  <input value={config.tagId ?? ''} onChange={(e) => set('tagId', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de contacto (opcional)</label>
                  <input value={config.contactId ?? ''} onChange={(e) => set('contactId', e.target.value)} placeholder="Por defecto usa el contacto del contexto" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
              </>
            )}

            {subtype === 'ASSIGN_CONVERSATION' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de conversación</label>
                  <input value={config.conversationId ?? ''} onChange={(e) => set('conversationId', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de usuario asignado</label>
                  <input value={config.assignedToId ?? ''} onChange={(e) => set('assignedToId', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
              </>
            )}

            {subtype === 'UPDATE_ORDER_STATUS' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de pedido</label>
                  <input value={config.orderId ?? ''} onChange={(e) => set('orderId', e.target.value)} placeholder="{{event.payload.orderId}}" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Nuevo estado</label>
                  <select value={config.status ?? ''} onChange={(e) => set('status', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="">—</option>
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}

            {subtype === 'UPDATE_APPOINTMENT_STATUS' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de cita</label>
                  <input value={config.appointmentId ?? ''} onChange={(e) => set('appointmentId', e.target.value)} placeholder="{{event.payload.appointmentId}}" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Nuevo estado</label>
                  <select value={config.status ?? ''} onChange={(e) => set('status', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="">—</option>
                    {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}

            {subtype === 'WEBHOOK_CALL' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">URL</label>
                <input value={config.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
              </div>
            )}

            {subtype === 'NOTIFY' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Título</label>
                  <input value={config.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Pedido grande recibido" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Mensaje (opcional)</label>
                  <textarea value={config.body ?? ''} onChange={(e) => set('body', e.target.value)} rows={2} placeholder="{{event.payload.total}}" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Enlace (opcional)</label>
                  <input value={config.link ?? ''} onChange={(e) => set('link', e.target.value)} placeholder="/dashboard/orders" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de usuario (opcional)</label>
                  <input value={config.userId ?? ''} onChange={(e) => set('userId', e.target.value)} placeholder="Vacío = notifica a todo el equipo" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                </div>
              </>
            )}

            <p className="text-xs text-gray-400">
              Los campos de texto admiten variables como <code className="font-mono">{'{{contact.name}}'}</code> o{' '}
              <code className="font-mono">{'{{event.payload.total}}'}</code>, resueltas contra el contexto de la ejecución.
            </p>
          </>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onDelete} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> Eliminar
        </button>
        <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
          Cancelar
        </button>
        <button onClick={() => onSave({ subtype, config })} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
          Guardar nodo
        </button>
      </div>
    </Modal>
  );
}
