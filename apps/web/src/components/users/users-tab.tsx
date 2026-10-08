'use client';

import { useEffect, useState } from 'react';
import { Plus, UserCircle, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type { StaffUser, Role } from '@/lib/types';

interface BranchOption {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<StaffUser['status'], string> = {
  ACTIVE: 'Activo',
  INVITED: 'Invitado',
  DISABLED: 'Desactivado',
};

const STATUS_STYLES: Record<StaffUser['status'], string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INVITED: 'bg-amber-50 text-amber-700',
  DISABLED: 'bg-gray-100 text-gray-500',
};

function emptyForm() {
  return {
    id: null as string | null,
    email: '',
    password: '',
    status: 'ACTIVE' as StaffUser['status'],
    roleIds: [] as string[],
    branchIds: [] as string[],
  };
}

export function UsersTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const refetch = () => apiGet<StaffUser[]>('/users', tokens?.accessToken).then(setUsers);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      refetch(),
      apiGet<Role[]>('/roles', tokens.accessToken).then(setRoles),
      apiGet<BranchOption[]>('/branches', tokens.accessToken).then(setBranches),
    ])
      .catch((err) => console.error('Error fetching users:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (user: StaffUser) => {
    setForm({
      id: user.id,
      email: user.email,
      password: '',
      status: user.status,
      roleIds: user.roles.map((r) => r.id),
      branchIds: user.branches.map((b) => b.id),
    });
    setShowModal(true);
  };

  const toggleRole = (roleId: string) => {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(roleId) ? f.roleIds.filter((id) => id !== roleId) : [...f.roleIds, roleId],
    }));
  };

  const toggleBranch = (branchId: string) => {
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(branchId) ? f.branchIds.filter((id) => id !== branchId) : [...f.branchIds, branchId],
    }));
  };

  const save = async () => {
    if (!form.id) {
      if (!form.email.trim()) {
        toast.error('El email es obligatorio');
        return;
      }
      if (form.password.length < 8) {
        toast.error('La contraseña debe tener al menos 8 caracteres');
        return;
      }
      if (form.roleIds.length === 0) {
        toast.error('Elegí al menos un rol');
        return;
      }
    }
    setSaving(true);
    try {
      if (form.id) {
        await apiPatch(`/users/${form.id}`, tokens?.accessToken, {
          status: form.status,
          roleIds: form.roleIds,
          branchIds: form.branchIds,
        });
      } else {
        await apiPost('/users', tokens?.accessToken, {
          email: form.email,
          password: form.password,
          roleIds: form.roleIds,
          branchIds: form.branchIds,
        });
      }
      await refetch();
      setShowModal(false);
      toast.success('Usuario guardado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el usuario');
    } finally {
      setSaving(false);
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
          Gente de tu equipo que colabora en el negocio — cada uno con sus propios roles y, si corresponde, limitado
          a una o más sucursales. La contraseña se la pasás vos por fuera (WhatsApp, en persona, etc.), no se envía
          ningún email.
        </p>
        <button
          onClick={openCreate}
          disabled={roles.length === 0}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      {roles.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          No hay ningún rol todavía — creá uno en la pestaña "Roles" antes de dar de alta un usuario.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {users.map((user) => (
          <button key={user.id} onClick={() => openEdit(user)} className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <UserCircle className="w-4 h-4 text-gray-400 shrink-0" />
                <p className="text-sm font-bold text-gray-900 truncate">{user.email}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[user.status]}`}>
                {STATUS_LABELS[user.status]}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {user.roles.length === 0 && <span className="text-xs text-gray-400">Sin rol asignado</span>}
              {user.roles.map((r) => (
                <span key={r.id} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {r.name}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Building2 className="w-3.5 h-3.5" />
              {user.branches.length === 0 ? 'Todas las sucursales' : user.branches.map((b) => b.name).join(', ')}
            </div>
          </button>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar usuario' : 'Nuevo usuario'} size="lg">
        <div className="space-y-4">
          {!form.id && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="colega@tu-negocio.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Contraseña</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {form.id && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.status === 'ACTIVE'}
                onChange={(e) => setForm({ ...form, status: e.target.checked ? 'ACTIVE' : 'DISABLED' })}
              />
              Usuario activo (puede iniciar sesión)
            </label>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Roles</label>
            <div className="space-y-1.5 border border-gray-200 rounded-lg p-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />
                  {role.name}
                  {role.isSystem && <span className="text-xs text-gray-400">(sistema)</span>}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Sucursales</label>
            {form.branchIds.length === 0 && (
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-2">
                Sin marcar ninguna: el usuario maneja todas las sucursales.
              </p>
            )}
            <div className="space-y-1.5 border border-gray-200 rounded-lg p-2">
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.branchIds.includes(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                  />
                  {branch.name}
                </label>
              ))}
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
