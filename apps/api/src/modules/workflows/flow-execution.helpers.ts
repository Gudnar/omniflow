/**
 * Pure helpers for the Phase 16 (Workflows) graph-execution engine, kept
 * dependency-free (no Prisma) so they're directly unit-testable, mirroring
 * appointments.service.ts's exported interval-math helpers.
 */

export interface FlowEdgeLike {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
}

export interface ConditionConfig {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists';
  value?: any;
}

/** Resolves a dot-path (e.g. "event.payload.total") against a plain object. */
export function getByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** Evaluates a CONDITION node's config against a FlowExecution's contextData. */
export function evaluateCondition(config: ConditionConfig, contextData: any): boolean {
  const actual = getByPath(contextData, config.field);
  switch (config.operator) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'eq':
      return actual === config.value;
    case 'neq':
      return actual !== config.value;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(config.value);
      if (typeof actual === 'string') return actual.includes(String(config.value));
      return false;
    case 'gt':
      return Number(actual) > Number(config.value);
    case 'lt':
      return Number(actual) < Number(config.value);
    default:
      return false;
  }
}

/**
 * Finds the outgoing edge from `nodeId` matching `handle` ('true'/'false'
 * for CONDITION nodes, undefined for a plain single-outgoing-edge node).
 * Returns undefined when there is no matching edge (a valid, deliberate
 * terminal — not an error).
 */
export function pickNextEdge(
  edges: FlowEdgeLike[],
  nodeId: string,
  handle?: 'true' | 'false',
): FlowEdgeLike | undefined {
  const outgoing = edges.filter((e) => e.sourceNodeId === nodeId);
  if (handle) {
    return outgoing.find((e) => e.sourceHandle === handle);
  }
  return outgoing[0];
}

/** Resolves `{{path}}` placeholders in a string template against contextData. */
export function interpolate(template: string, contextData: any): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path) => {
    const value = getByPath(contextData, path);
    return value === undefined || value === null ? '' : String(value);
  });
}
