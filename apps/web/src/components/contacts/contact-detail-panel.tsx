'use client';

import { useEffect, useState } from 'react';
import { Pencil, X, Mail, Radio, Calendar, Building2, Trash2, MapPin, Star, ShoppingCart, Link2, Copy, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { Contact, Note, Activity, ActivityType, CustomerAddress, Cart, Order, Appointment } from '@/lib/types';
import { ChannelIcon } from '@/components/conversations/channel-icon';
import { Modal } from '@/components/ui/modal';
import type { Channel } from '@/components/conversations/mock-data';

const tabs = ['Información', 'CRM', 'Notas', 'Actividad', 'Direcciones', 'Pedidos', 'Citas'] as const;

const TYPE_LABELS: Record<Contact['type'], string> = { LEAD: 'Lead', PROSPECT: 'Prospecto', CUSTOMER: 'Cliente' };
const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: 'Llamada',
  EMAIL: 'Email',
  MEETING: 'Reunión',
  WHATSAPP: 'WhatsApp',
  TASK: 'Tarea',
  OTHER: 'Otro',
};
const ORDER_STATUS_LABELS: Record<string, string> = { CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado' };
const FULFILLMENT_LABELS: Record<string, string> = { PICKUP: 'Retiro', LOCAL_DELIVERY: 'Entrega a domicilio', SHIPPING: 'Envío' };
const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No se presentó',
};

const CHANNEL_SOURCES = new Set(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'MESSENGER']);

const EMPTY_ADDRESS_FORM = { label: '', recipientName: '', phone: '', addressLine: '', city: '', zone: '', notes: '' };

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function ContactDetailPanel({
  contactId,
  onClose,
  onEdit,
  onChanged,
}: {
  contactId: string;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onChanged: () => void;
}) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Información');
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [noteText, setNoteText] = useState('');
  const [activityForm, setActivityForm] = useState({ type: 'CALL' as ActivityType, subject: '' });
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS_FORM);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [activeCart, setActiveCart] = useState<Cart | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [storefrontLink, setStorefrontLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    setActiveTab('Información');
    setNotes(null);
    setActivities(null);
    setAddresses(null);
    setActiveCart(undefined);
    setOrders(null);
    setAppointments(null);
    setStorefrontLink(null);
    apiGet<Contact>(`/contacts/${contactId}`, tokens?.accessToken)
      .then(setContact)
      .catch((err) => console.error('Error fetching contact:', err));
  }, [contactId, tokens]);

  useEffect(() => {
    if (activeTab === 'Notas' && notes === null) {
      apiGet<Note[]>(`/contacts/${contactId}/notes`, tokens?.accessToken)
        .then(setNotes)
        .catch((err) => console.error('Error fetching notes:', err));
    }
    if (activeTab === 'Actividad' && activities === null) {
      apiGet<Activity[]>(`/contacts/${contactId}/activities`, tokens?.accessToken)
        .then(setActivities)
        .catch((err) => console.error('Error fetching activities:', err));
    }
    if (activeTab === 'Direcciones' && addresses === null) {
      apiGet<CustomerAddress[]>(`/contacts/${contactId}/addresses`, tokens?.accessToken)
        .then(setAddresses)
        .catch((err) => console.error('Error fetching addresses:', err));
    }
    if (activeTab === 'CRM' && activeCart === undefined) {
      apiGet<Cart | null>(`/contacts/${contactId}/active-cart`, tokens?.accessToken)
        .then(setActiveCart)
        .catch((err) => console.error('Error fetching active cart:', err));
    }
    if (activeTab === 'Pedidos' && orders === null) {
      apiGet<Order[]>(`/contacts/${contactId}/orders`, tokens?.accessToken)
        .then(setOrders)
        .catch((err) => console.error('Error fetching orders:', err));
    }
    if (activeTab === 'Citas' && appointments === null) {
      apiGet<Appointment[]>(`/appointments?contactId=${contactId}`, tokens?.accessToken)
        .then(setAppointments)
        .catch((err) => console.error('Error fetching appointments:', err));
    }
  }, [activeTab, contactId, notes, activities, addresses, activeCart, orders, appointments, tokens]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      const created = await apiPost<Note>(`/contacts/${contactId}/notes`, tokens?.accessToken, { body: noteText });
      setNotes((prev) => [created, ...(prev ?? [])]);
      setNoteText('');
      toast.success('Nota agregada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar la nota');
    }
  };

  const generateStorefrontLink = async () => {
    setGeneratingLink(true);
    try {
      const result = await apiPost<{ url: string }>(`/contacts/${contactId}/storefront-link`, tokens?.accessToken, {});
      setStorefrontLink(result.url);
      toast.success('Enlace de la tienda generado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al generar el enlace de la tienda');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyStorefrontLink = () => {
    if (!storefrontLink) return;
    navigator.clipboard
      ?.writeText(storefrontLink)
      .then(() => toast.success('Enlace copiado al portapapeles'))
      .catch(() => toast.error('No se pudo copiar el enlace'));
  };

  const addActivity = async () => {
    if (!activityForm.subject.trim()) return;
    try {
      const created = await apiPost<Activity>(`/contacts/${contactId}/activities`, tokens?.accessToken, activityForm);
      setActivities((prev) => [created, ...(prev ?? [])]);
      setActivityForm({ type: 'CALL', subject: '' });
      toast.success('Actividad agregada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar la actividad');
    }
  };

  const detachTag = async (tagId: string) => {
    try {
      await apiDelete(`/contacts/${contactId}/tags/${tagId}`, tokens?.accessToken);
      setContact((prev) => (prev ? { ...prev, tags: prev.tags.filter((t) => t.tagId !== tagId) } : prev));
      onChanged();
      toast.success('Etiqueta quitada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo quitar la etiqueta');
    }
  };

  const refetchAddresses = () =>
    apiGet<CustomerAddress[]>(`/contacts/${contactId}/addresses`, tokens?.accessToken).then(setAddresses);

  const saveAddress = async () => {
    try {
      if (editingAddressId) {
        await apiPatch(`/contacts/${contactId}/addresses/${editingAddressId}`, tokens?.accessToken, addressForm);
      } else {
        await apiPost(`/contacts/${contactId}/addresses`, tokens?.accessToken, addressForm);
      }
      await refetchAddresses();
      setAddressForm(EMPTY_ADDRESS_FORM);
      setEditingAddressId(null);
      setShowAddressModal(false);
      toast.success(editingAddressId ? 'Dirección actualizada correctamente' : 'Dirección agregada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar la dirección');
    }
  };

  const openNewAddress = () => {
    setEditingAddressId(null);
    setAddressForm(EMPTY_ADDRESS_FORM);
    setShowAddressModal(true);
  };

  const editAddress = (address: CustomerAddress) => {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine: address.addressLine,
      city: address.city ?? '',
      zone: address.zone ?? '',
      notes: address.notes ?? '',
    });
    setShowAddressModal(true);
  };

  const setDefaultAddress = async (addressId: string) => {
    try {
      await apiPatch(`/contacts/${contactId}/addresses/${addressId}`, tokens?.accessToken, { isDefault: true });
      await refetchAddresses();
      toast.success('Dirección predeterminada actualizada');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar la dirección predeterminada');
    }
  };

  const removeAddress = async (addressId: string) => {
    if (!confirm('¿Eliminar esta dirección?')) return;
    try {
      await apiDelete(`/contacts/${contactId}/addresses/${addressId}`, tokens?.accessToken);
      await refetchAddresses();
      toast.success('Dirección eliminada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar la dirección');
    }
  };

  if (!contact) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const infoRows = [
    { icon: Building2, label: 'Empresa', value: contact.company?.name ?? '—' },
    { icon: Radio, label: 'Fuente', value: contact.source ?? '—' },
    { icon: Calendar, label: 'Cliente desde', value: new Date(contact.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-full bg-pink-500 flex items-center justify-center text-white font-semibold text-lg shrink-0">
            {initialsOf(contact.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-base font-bold text-gray-900 truncate">{contact.name}</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {TYPE_LABELS[contact.type]}
              </span>
              <button onClick={() => onEdit(contact)}>
                <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {contact.source && CHANNEL_SOURCES.has(contact.source) && (
                <ChannelIcon channel={contact.source.toLowerCase() as Channel} className="w-3.5 h-3.5" />
              )}
              <span className="text-sm text-gray-600">{contact.phone || '—'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-5 overflow-x-auto shrink-0">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-2.5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
              activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {activeTab === 'Información' && (
          <>
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Información de contacto</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="flex-1 text-gray-700 truncate">{contact.email || '—'}</span>
                </div>
                {infoRows.map((row) => (
                  <div key={row.label} className="flex items-center gap-3 text-sm">
                    <row.icon className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-500">{row.label}</span>
                    <span className="flex-1 text-right font-medium text-gray-900">{row.value}</span>
                  </div>
                ))}
                {['Ubicación', 'Fecha de nacimiento', 'Idioma'].map((label) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <span className="w-4 h-4 shrink-0" />
                    <span className="text-gray-500">{label}</span>
                    <span className="flex-1 text-right font-medium text-gray-400">—</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Etiquetas</h4>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: `${tag.color ?? '#e5e7eb'}22`, color: tag.color ?? '#4b5563' }}
                  >
                    {tag.name}
                    <button onClick={() => detachTag(tag.id)} className="text-[10px] opacity-60 hover:opacity-100">
                      ✕
                    </button>
                  </span>
                ))}
                {contact.tags.length === 0 && <span className="text-xs text-gray-400">Sin etiquetas</span>}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Resumen</h4>
              <div className="grid grid-cols-2 gap-3">
                {['Total pedidos', 'Total gastado', 'Último pedido', 'Citas completadas'].map((label) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-lg font-bold text-gray-400">—</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Asignación</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Agente</span>
                  <span className="font-medium text-gray-400">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Estado</span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      contact.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {contact.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'Notas' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Escribe una nota..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addNote}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shrink-0"
              >
                Agregar nota
              </button>
            </div>
            <div className="space-y-3">
              {(notes ?? []).map((note) => (
                <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-800">{note.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(note.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {notes !== null && notes.length === 0 && <p className="text-sm text-gray-400">Sin notas todavía.</p>}
            </div>
          </div>
        )}

        {activeTab === 'Actividad' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <select
                value={activityForm.type}
                onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as ActivityType })}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm shrink-0"
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
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addActivity}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shrink-0"
              >
                Agregar
              </button>
            </div>
            <div className="space-y-3">
              {(activities ?? []).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 shrink-0">
                    {ACTIVITY_TYPE_LABELS[activity.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.subject}</p>
                    <p className="text-xs text-gray-400">{new Date(activity.occurredAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {activities !== null && activities.length === 0 && (
                <p className="text-sm text-gray-400">Sin actividad registrada.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Direcciones' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={openNewAddress}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva dirección
              </button>
            </div>
            <div className="space-y-2">
              {(addresses ?? []).map((address) => (
                <div key={address.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{address.label}</p>
                          {address.isDefault && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                              Predeterminada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{address.addressLine}{address.city ? `, ${address.city}` : ''}</p>
                        <p className="text-xs text-gray-400">{address.recipientName} · {address.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!address.isDefault && (
                        <button onClick={() => setDefaultAddress(address.id)} title="Marcar predeterminada" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => editAddress(address)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeAddress(address.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {addresses !== null && addresses.length === 0 && (
                <p className="text-sm text-gray-400">Sin direcciones todavía.</p>
              )}
            </div>

            <Modal
              open={showAddressModal}
              onClose={() => setShowAddressModal(false)}
              title={editingAddressId ? 'Editar dirección' : 'Nueva dirección'}
            >
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} placeholder="Etiqueta (ej. Casa)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input value={addressForm.recipientName} onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })} placeholder="Nombre del destinatario" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} placeholder="Teléfono" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} placeholder="Ciudad" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <input value={addressForm.addressLine} onChange={(e) => setAddressForm({ ...addressForm, addressLine: e.target.value })} placeholder="Dirección" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
                >
                  Cancelar
                </button>
                <button onClick={saveAddress} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
                  {editingAddressId ? 'Actualizar' : 'Agregar dirección'}
                </button>
              </div>
            </Modal>
          </div>
        )}

        {activeTab === 'CRM' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gray-400" /> Tienda en línea
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                Genera un enlace público para que el contacto vea el catálogo, confirme su ubicación y compre
                directamente. Válido por 48 horas.
              </p>
              <button
                onClick={generateStorefrontLink}
                disabled={generatingLink}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
              >
                {storefrontLink ? 'Regenerar enlace' : 'Generar enlace de tienda'}
              </button>
              {storefrontLink && (
                <div className="flex items-center gap-2 mt-2">
                  <input readOnly value={storefrontLink} className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600" />
                  <button onClick={copyStorefrontLink} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0" title="Copiar">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-400" /> Carrito activo
            </h4>
            {activeCart === undefined && (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full" />
              </div>
            )}
            {activeCart === null && <p className="text-sm text-gray-400">Este contacto no tiene un carrito activo.</p>}
            {activeCart && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {activeCart.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                      <div>
                        <p className="font-medium text-gray-900">{item.product.name}</p>
                        <p className="text-xs text-gray-400">{item.variant.name || item.variant.sku} · x{item.quantity}</p>
                      </div>
                      <p className="font-semibold text-gray-900">{activeCart.currency} {item.subtotal.toFixed(2)}</p>
                    </div>
                  ))}
                  {activeCart.items.length === 0 && <p className="text-sm text-gray-400">Carrito vacío.</p>}
                </div>
                <div className="flex items-center justify-between pt-2 text-sm font-bold text-gray-900">
                  <span>Total</span>
                  <span>{activeCart.currency} {activeCart.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Pedidos' && (
          <div className="space-y-3">
            {(orders ?? []).map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">{order.orderNumber}</p>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      order.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString()} · {FULFILLMENT_LABELS[order.fulfillmentType]}
                </p>
                <p className="text-sm font-bold text-gray-900 mt-1">{order.currency} {order.total.toFixed(2)}</p>
              </div>
            ))}
            {orders !== null && orders.length === 0 && <p className="text-sm text-gray-400">Sin pedidos todavía.</p>}
          </div>
        )}

        {activeTab === 'Citas' && (
          <div className="space-y-3">
            {(appointments ?? []).map((appointment) => (
              <div key={appointment.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {appointment.services[0]?.serviceNameSnapshot ?? 'Cita'}
                  </p>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      appointment.status === 'CONFIRMED' || appointment.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {APPOINTMENT_STATUS_LABELS[appointment.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(appointment.startAt).toLocaleDateString()}{' '}
                  {new Date(appointment.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                  {appointment.branch.name}
                </p>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {appointment.currency} {appointment.total.toFixed(2)}
                </p>
              </div>
            ))}
            {appointments !== null && appointments.length === 0 && (
              <p className="text-sm text-gray-400">Sin citas todavía.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
