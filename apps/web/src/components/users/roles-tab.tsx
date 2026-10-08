'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type { Role, Permission } from '@/lib/types';

// Spanish label for each permission-code prefix (module) — falls back to the
// raw prefix, capitalized, for any module added later without updating this.
const MODULE_LABELS: Record<string, string> = {
  tenant: 'Negocio',
  users: 'Usuarios',
  roles: 'Roles',
  branches: 'Sucursales',
  contacts: 'Contactos',
  companies: 'Empresas',
  tags: 'Etiquetas',
  conversations: 'Conversaciones',
  channels: 'Canales',
  ecommerce: 'Ecommerce (tienda)',
  products: 'Productos',
  commerce: 'Carritos y sesiones',
  orders: 'Pedidos',
  booking: 'Reservas — configuración',
  appointments: 'Citas',
  workflows: 'Flujos (automatizaciones)',
  templates: 'Plantillas de WhatsApp',
  campaigns: 'Campañas',
  payments: 'Métodos de pago',
  ai: 'IA Agents',
  comments: 'Comentarios de Facebook',
  'link-page': 'Página de enlaces',
  analytics: 'Analytics',
};

function moduleOf(code: string) {
  return code.split('.')[0];
}

function moduleLabel(prefix: string) {
  return MODULE_LABELS[prefix] ?? prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function emptyForm() {
  return { id: null as string | null, name: '', permissionCodes: [] as string[] };
}

export function RolesTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const refetch = () => apiGet<Role[]>('/roles', tokens?.accessToken).then(setRoles);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([refetch(), apiGet<Permission[]>('/roles/permissions-catalog', tokens.accessToken).then(setCatalog)])
      .catch((err) => console.error('Error fetching roles:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const grouped = useMemo(() => {
    const byModule = new Map<string, Permission[]>();
    for (const perm of catalog) {
      const mod = moduleOf(perm.code);
      if (!byModule.has(mod)) byModule.set(mod, []);
      byModule.get(mod)!.push(perm);
    }
    return Array.from(byModule.entries()).sort(([a], [b]) => moduleLabel(a).localeCompare(moduleLabel(b)));
  }, [catalog]);

  const openCreate = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (role: Role) => {
    setForm({ id: role.id, name: role.name, permissionCodes: role.permissions.map((p) => p.permission.code) });
    setShowModal(true);
  };

  const togglePermission = (code: string) => {
    setForm((f) => ({
      ...f,
      permissionCodes: f.permissionCodes.includes(code)
        ? f.permissionCodes.filter((c) => c !== code)
        : [...f.permissionCodes, code],
    }));
  };

  const toggleModule = (mod: string, codes: string[]) => {
    const allSelected = codes.every((c) => form.permissionCodes.includes(c));
    setForm((f) => ({
      ...f,
      permissionCodes: allSelected
        ? f.permissionCodes.filter((c) => !codes.includes(c))
        : Array.from(new Set([...f.permissionCodes, ...codes])),
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre del rol es obligatorio');
      return;
    }
    if (form.permissionCodes.length === 0) {
      toast.error('Elegí al menos un permiso');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name, permissionCodes: form.permissionCodes };
      if (form.id) {
        await apiPatch(`/roles/${form.id}`, tokens?.accessToken, payload);
      } else {
        await apiPost('/roles', tokens?.accessToken, payload);
      }
      await refetch();
      setShowModal(false);
      toast.success('Rol guardado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el rol');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: Role) => {
    if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;
    try {
      await apiDelete(`/roles/${role.id}`, tokens?.accessToken);
      await refetch();
      toast.success('Rol eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el rol');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-3">
        <p className="text-sm text-gray-500 max-w-2xl">
          Un rol es un conjunto de permisos reutilizable — asignale uno o más a cada usuario. Los roles del sistema
          (OWNER, ADMIN, MEMBER) no se pueden editar ni borrar.
        </p>
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo rol
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {roles.map((role) => (
          <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-bold text-gray-900">{role.name}</p>
              </div>
              {role.isSystem ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  <Lock className="w-3 h-3" /> Sistema
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(role)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(role)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {role.permissions.length} permiso{role.permissions.length === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar rol' : 'Nuevo rol'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Despachador de pedidos"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Permisos</label>
            <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {grouped.map(([mod, perms]) => {
                const codes = perms.map((p) => p.code);
                const allSelected = codes.every((c) => form.permissionCodes.includes(c));
                return (
                  <div key={mod}>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1">
                      <input type="checkbox" checked={allSelected} onChange={() => toggleModule(mod, codes)} />
                      {moduleLabel(mod)}
                    </label>
                    <div className="pl-5 space-y-1">
                      {perms.map((perm) => (
                        <label key={perm.code} className="flex items-start gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={form.permissionCodes.includes(perm.code)}
                            onChange={() => togglePermission(perm.code)}
                          />
                          <span>
                            <span className="font-mono text-xs">{perm.code}</span>
                            {perm.description && <span className="block text-xs text-gray-400">{perm.description}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
