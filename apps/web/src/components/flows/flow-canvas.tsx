'use client';

import '@xyflow/react/dist/style.css';
import { useCallback, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import type { Node, Edge, Connection, NodeProps, NodeTypes } from '@xyflow/react';
import { Zap, GitBranch, Play, Clock3, Flag, Save, Power, PlayCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiPatch, apiPost } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import { NodeConfigModal, type NodeFormValue } from './node-config-modal';
import type { Flow, FlowNodeType } from '@/lib/types';

const TYPE_META: Record<FlowNodeType, { label: string; icon: any; color: string }> = {
  TRIGGER: { label: 'Disparador', icon: Zap, color: 'border-purple-300 bg-purple-50' },
  CONDITION: { label: 'Condición', icon: GitBranch, color: 'border-amber-300 bg-amber-50' },
  ACTION: { label: 'Acción', icon: Play, color: 'border-blue-300 bg-blue-50' },
  WAIT: { label: 'Espera', icon: Clock3, color: 'border-gray-300 bg-gray-50' },
  END: { label: 'Fin', icon: Flag, color: 'border-gray-300 bg-gray-100' },
};

function summarize(type: FlowNodeType, subtype: string, config: Record<string, any>): string {
  if (type === 'TRIGGER') {
    if (subtype === 'EVENT') return config.eventType || 'sin evento';
    if (subtype === 'SCHEDULE') return config.cron || 'sin cron';
    return 'manual';
  }
  if (type === 'CONDITION') {
    return `${config.field || '?'} ${config.operator || 'eq'} ${config.operator === 'exists' ? '' : config.value ?? ''}`;
  }
  if (type === 'WAIT') return `${config.delayMinutes ?? 0} min`;
  if (type === 'ACTION') {
    switch (subtype) {
      case 'SEND_MESSAGE': return config.content ? `"${config.content.slice(0, 24)}…"` : 'mensaje';
      case 'ADD_NOTE': return config.body ? `"${config.body.slice(0, 24)}…"` : 'nota';
      case 'ADD_TAG': case 'REMOVE_TAG': return config.tagId || 'tag';
      case 'ASSIGN_CONVERSATION': return config.assignedToId || 'sin asignar';
      case 'UPDATE_ORDER_STATUS': return config.status ? `pedido → ${config.status}` : 'pedido';
      case 'UPDATE_APPOINTMENT_STATUS': return config.status ? `cita → ${config.status}` : 'cita';
      case 'WEBHOOK_CALL': return config.url || 'webhook';
      default: return subtype;
    }
  }
  return '';
}

function FlowNodeView({ data, selected }: NodeProps) {
  const d = data as any;
  const meta = TYPE_META[d.type as FlowNodeType];
  const Icon = meta.icon;
  return (
    <div
      className={`relative px-3 py-2.5 rounded-lg border-2 shadow-sm text-xs min-w-[170px] ${meta.color} ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}
    >
      {d.type !== 'TRIGGER' && <Handle type="target" position={Position.Left} className="!bg-gray-400" />}
      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        <Icon className="w-3 h-3" /> {meta.label}
      </div>
      <div className="font-semibold text-gray-900">{d.subtype}</div>
      {d.summary && <div className="text-gray-500 mt-0.5 truncate max-w-[190px]">{d.summary}</div>}

      {d.type === 'CONDITION' ? (
        <>
          <Handle type="source" id="true" position={Position.Right} style={{ top: '35%', background: '#10b981' }} />
          <Handle type="source" id="false" position={Position.Right} style={{ top: '70%', background: '#ef4444' }} />
          <span className="absolute -right-1 top-[27%] text-[9px] font-bold text-emerald-600">Sí</span>
          <span className="absolute -right-1 top-[62%] text-[9px] font-bold text-red-500">No</span>
        </>
      ) : d.type !== 'END' ? (
        <Handle type="source" position={Position.Right} className="!bg-gray-400" />
      ) : null}
    </div>
  );
}

const NODE_TYPES: NodeTypes = { flowNode: FlowNodeView };

const DEFAULT_SUBTYPE: Record<FlowNodeType, string> = {
  TRIGGER: 'EVENT',
  CONDITION: 'FIELD_COMPARISON',
  ACTION: 'ADD_NOTE',
  WAIT: 'DELAY',
  END: 'END',
};

function toRFNodes(flow: Flow): Node[] {
  return flow.nodes.map((n) => ({
    id: n.id,
    type: 'flowNode',
    position: { x: n.positionX, y: n.positionY },
    data: { type: n.type, subtype: n.subtype, name: n.name, config: n.config, summary: summarize(n.type, n.subtype, n.config) },
  }));
}

function toRFEdges(flow: Flow): Edge[] {
  return flow.edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    sourceHandle: e.sourceHandle ?? undefined,
    style: e.sourceHandle === 'false' ? { stroke: '#ef4444' } : e.sourceHandle === 'true' ? { stroke: '#10b981' } : undefined,
    animated: false,
  }));
}

function CanvasInner({ flow, onSaved }: { flow: Flow; onSaved: (f: Flow) => void }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toRFNodes(flow));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toRFEdges(flow));
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTestRun, setShowTestRun] = useState(false);
  const [testContext, setTestContext] = useState('{}');

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            style: connection.sourceHandle === 'false' ? { stroke: '#ef4444' } : connection.sourceHandle === 'true' ? { stroke: '#10b981' } : undefined,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const addNode = (type: FlowNodeType) => {
    const id = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const position = screenToFlowPosition({ x: 260 + Math.random() * 60, y: 160 + Math.random() * 200 });
    const subtype = DEFAULT_SUBTYPE[type];
    setNodes((nds) => [
      ...nds,
      { id, type: 'flowNode', position, data: { type, subtype, config: {}, summary: summarize(type, subtype, {}) } },
    ]);
  };

  const configNode = nodes.find((n) => n.id === configNodeId);

  const saveNodeConfig = (value: NodeFormValue) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === configNodeId
          ? { ...n, data: { ...n.data, subtype: value.subtype, config: value.config, summary: summarize((n.data as any).type, value.subtype, value.config) } }
          : n,
      ),
    );
    setConfigNodeId(null);
  };

  const deleteNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== configNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== configNodeId && e.target !== configNodeId));
    setConfigNodeId(null);
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        nodes: nodes.map((n) => ({
          clientId: n.id,
          type: (n.data as any).type,
          subtype: (n.data as any).subtype,
          name: (n.data as any).name,
          config: (n.data as any).config ?? {},
          positionX: n.position.x,
          positionY: n.position.y,
        })),
        edges: edges.map((e) => ({
          sourceClientId: e.source,
          targetClientId: e.target,
          sourceHandle: (e.sourceHandle as 'true' | 'false' | undefined) ?? undefined,
        })),
      };
      const updated = await apiPatch<Flow>(`/workflows/flows/${flow.id}`, tokens?.accessToken, payload);
      onSaved(updated);
      setNodes(toRFNodes(updated));
      setEdges(toRFEdges(updated));
      toast.success('Flujo guardado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al guardar el flujo');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    setBusy(true);
    try {
      const nextStatus = flow.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const updated = await apiPatch<Flow>(`/workflows/flows/${flow.id}`, tokens?.accessToken, { status: nextStatus });
      onSaved({ ...updated, nodes: flow.nodes, edges: flow.edges });
      toast.success(nextStatus === 'ACTIVE' ? 'Flujo activado correctamente' : 'Flujo desactivado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al cambiar el estado');
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    try {
      const contextData = testContext.trim() ? JSON.parse(testContext) : {};
      await apiPost(`/workflows/flows/${flow.id}/test-run`, tokens?.accessToken, { contextData });
      setShowTestRun(false);
      toast.success('Ejecución de prueba iniciada. Revisa la pestaña Ejecuciones.');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al ejecutar la prueba');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          {(['TRIGGER', 'CONDITION', 'ACTION', 'WAIT'] as FlowNodeType[]).map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            return (
              <button
                key={t}
                onClick={() => addNode(t)}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Icon className="w-3.5 h-3.5" /> {meta.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTestRun(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Ejecutar prueba
          </button>
          <button
            onClick={toggleStatus}
            disabled={busy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${
              flow.status === 'ACTIVE' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Power className="w-3.5 h-3.5" /> {flow.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" /> Guardar
          </button>
        </div>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
          onNodeClick={(_, node) => setConfigNodeId(node.id)}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      {configNode && (
        <NodeConfigModal
          open
          nodeType={(configNode.data as any).type}
          initial={{ subtype: (configNode.data as any).subtype, config: (configNode.data as any).config ?? {} }}
          onClose={() => setConfigNodeId(null)}
          onSave={saveNodeConfig}
          onDelete={deleteNode}
        />
      )}

      <Modal open={showTestRun} onClose={() => setShowTestRun(false)} title="Ejecutar prueba">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Contexto de ejemplo (JSON) que recibirán las condiciones/acciones, p. ej. <code>{'{"contact":{"id":"..."}}'}</code>.
          </p>
          <textarea
            value={testContext}
            onChange={(e) => setTestContext(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
          />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setShowTestRun(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button onClick={runTest} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            Ejecutar
          </button>
        </div>
      </Modal>
    </div>
  );
}

export function FlowCanvas({ flow, onSaved }: { flow: Flow; onSaved: (f: Flow) => void }) {
  return (
    <ReactFlowProvider>
      <CanvasInner flow={flow} onSaved={onSaved} />
    </ReactFlowProvider>
  );
}
