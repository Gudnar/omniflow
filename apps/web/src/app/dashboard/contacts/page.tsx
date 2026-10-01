'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, Plus, ArrowUp } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { Contact, Company, Tag, ContactType, ContactSource } from '@/lib/types';
import { ContactsTable } from '@/components/contacts/contacts-table';
import { ContactDetailPanel } from '@/components/contacts/contact-detail-panel';
import { Modal } from '@/components/ui/modal';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  type: 'LEAD' as ContactType,
  source: '' as ContactSource | '',
  companyId: '',
  tagIds: [] as string[],
};

export default function ContactsPage() {
  const router = useRouter();
  const { user, tokens, isLoading } = useAuth();
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user && tokens) fetchAll();
  }, [user, tokens]);

  const fetchAll = async () => {
    try {
      const [contactsData, companiesData, tagsData] = await Promise.all([
        apiGet<Contact[]>('/contacts', tokens?.accessToken),
        apiGet<Company[]>('/companies', tokens?.accessToken),
        apiGet<Tag[]>('/tags', tokens?.accessToken),
      ]);
      setContacts(contactsData);
      setCompanies(companiesData);
      setTags(tagsData);
      setSelectedId((current) => current ?? contactsData[0]?.id ?? null);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingId(contact.id);
    setFormData({
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      type: contact.type,
      source: contact.source ?? '',
      companyId: contact.companyId ?? '',
      tagIds: contact.tags.map((t) => t.tagId),
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const payload: Record<string, unknown> = {
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      type: formData.type,
      source: formData.source || undefined,
      companyId: formData.companyId || undefined,
    };

    try {
      if (editingId) {
        await apiPatch(`/contacts/${editingId}`, tokens?.accessToken, payload);
      } else {
        await apiPost('/contacts', tokens?.accessToken, { ...payload, tagIds: formData.tagIds });
      }
      await fetchAll();
      setShowModal(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      toast.success(editingId ? 'Contacto actualizado correctamente' : 'Contacto creado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el contacto');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este contacto?')) return;
    try {
      await apiDelete(`/contacts/${id}`, tokens?.accessToken);
      if (selectedId === id) setSelectedId(null);
      await fetchAll();
      toast.success('Contacto eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el contacto');
    }
  };

  if (isLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Contactos', value: contacts.length },
    {
      label: 'Contactos Nuevos',
      value: contacts.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000).length,
    },
    { label: 'Contactos Activos', value: contacts.filter((c) => c.status === 'ACTIVE').length },
    { label: 'Clientes', value: contacts.filter((c) => c.type === 'CUSTOMER').length },
  ];

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Stats + actions */}
      <div className="flex flex-col xl:flex-row xl:items-start gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mb-2">{s.value}</p>
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-400">
                <ArrowUp className="w-3.5 h-3.5 opacity-0" />
                <span>—</span>
                <span className="text-gray-400 font-normal">vs mes anterior</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
          >
            <Plus className="w-4 h-4" />
            Nuevo contacto
          </button>
        </div>
      </div>

      {/* Table + detail panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">
        <ContactsTable
          contacts={contacts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />
        {selectedId && (
          <div className="sticky top-6 h-[calc(100vh-8rem)] hidden xl:block">
            <ContactDetailPanel
              contactId={selectedId}
              onClose={() => setSelectedId(null)}
              onEdit={openEditModal}
              onChanged={fetchAll}
            />
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar contacto' : 'Nuevo contacto'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Email</label>
            <input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Teléfono</label>
            <input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ContactType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LEAD">Lead</option>
                <option value="PROSPECT">Prospecto</option>
                <option value="CUSTOMER">Cliente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Fuente</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as ContactSource })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">—</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="TIKTOK">TikTok</option>
                <option value="MESSENGER">Messenger</option>
                <option value="WEBSITE">Sitio web</option>
                <option value="REFERRAL">Referido</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Empresa</label>
            <select
              value={formData.companyId}
              onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">—</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {!editingId && tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Etiquetas</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = formData.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          tagIds: active ? prev.tagIds.filter((id) => id !== tag.id) : [...prev.tagIds, tag.id],
                        }))
                      }
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border transition ${
                        active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
          >
            {editingId ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
