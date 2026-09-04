'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@omniflow/ui';
import { useAuth } from '@/lib/auth-context';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE';
  address?: string;
  timezone?: string;
  createdAt: string;
}

export default function BranchesPage() {
  const router = useRouter();
  const { user, tokens, isLoading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', timezone: 'UTC' });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user && tokens) {
      fetchBranches();
    }
  }, [user, tokens]);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches', {
        headers: {
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json() as Branch[];
        setBranches(data);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchBranches();
        setShowModal(false);
        setFormData({ name: '', address: '', timezone: 'UTC' });
      }
    } catch (err) {
      console.error('Error creating branch:', err);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/branches/${editingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchBranches();
        setShowModal(false);
        setEditingId(null);
        setFormData({ name: '', address: '', timezone: 'UTC' });
      }
    } catch (err) {
      console.error('Error updating branch:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres desactivar esta sucursal?')) return;
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });
      if (res.ok) {
        await fetchBranches();
      }
    } catch (err) {
      console.error('Error deleting branch:', err);
    }
  };

  const openEditModal = (branch: Branch) => {
    setEditingId(branch.id);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      timezone: branch.timezone || 'UTC',
    });
    setShowModal(true);
  };

  if (isLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sucursales</h1>
            <p className="text-gray-600 mt-1">Gestiona las sucursales de tu empresa</p>
          </div>
          <Button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', address: '', timezone: 'UTC' });
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2"
          >
            <Plus className="w-5 h-5" /> Nueva Sucursal
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {branches.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay sucursales</h3>
            <p className="text-gray-600 mb-6">Comienza creando tu primera sucursal</p>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', address: '', timezone: 'UTC' });
                setShowModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white mx-auto flex gap-2"
            >
              <Plus className="w-5 h-5" /> Crear Sucursal
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nombre</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Slug</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Ubicación</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Zona Horaria</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{branch.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{branch.slug}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{branch.address || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{branch.timezone}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          branch.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {branch.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(branch)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(branch.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Desactivar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingId ? 'Editar Sucursal' : 'Nueva Sucursal'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre de la sucursal"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Ubicación</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Dirección"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Zona Horaria</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>UTC</option>
                  <option>America/New_York</option>
                  <option>America/Los_Angeles</option>
                  <option>America/Denver</option>
                  <option>Europe/London</option>
                  <option>Europe/Madrid</option>
                  <option>America/Mexico_City</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                  setFormData({ name: '', address: '', timezone: 'UTC' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <Button
                onClick={editingId ? handleUpdate : handleCreate}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingId ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
