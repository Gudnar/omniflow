import { getByPath, evaluateCondition, pickNextEdge, interpolate } from './flow-execution.helpers';

describe('getByPath', () => {
  it('resolves a nested dot-path', () => {
    expect(getByPath({ event: { payload: { total: 42 } } }, 'event.payload.total')).toBe(42);
  });

  it('returns undefined for a missing path without throwing', () => {
    expect(getByPath({ event: {} }, 'event.payload.total')).toBeUndefined();
    expect(getByPath(null, 'a.b')).toBeUndefined();
  });
});

describe('evaluateCondition', () => {
  const ctx = { contact: { tags: ['vip', 'lead'], score: 10 }, event: { payload: { total: 100 } } };

  it('eq compares strict equality', () => {
    expect(evaluateCondition({ field: 'contact.score', operator: 'eq', value: 10 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: 'contact.score', operator: 'eq', value: 11 }, ctx)).toBe(false);
  });

  it('neq is the inverse of eq', () => {
    expect(evaluateCondition({ field: 'contact.score', operator: 'neq', value: 11 }, ctx)).toBe(true);
  });

  it('contains checks array membership or substring', () => {
    expect(evaluateCondition({ field: 'contact.tags', operator: 'contains', value: 'vip' }, ctx)).toBe(true);
    expect(evaluateCondition({ field: 'contact.tags', operator: 'contains', value: 'missing' }, ctx)).toBe(false);
  });

  it('gt/lt compare numerically', () => {
    expect(evaluateCondition({ field: 'event.payload.total', operator: 'gt', value: 50 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: 'event.payload.total', operator: 'lt', value: 50 }, ctx)).toBe(false);
  });

  it('exists checks presence', () => {
    expect(evaluateCondition({ field: 'contact.score', operator: 'exists' }, ctx)).toBe(true);
    expect(evaluateCondition({ field: 'contact.missing', operator: 'exists' }, ctx)).toBe(false);
  });
});

describe('pickNextEdge', () => {
  const edges = [
    { id: 'e1', sourceNodeId: 'cond1', targetNodeId: 'action-true', sourceHandle: 'true' },
    { id: 'e2', sourceNodeId: 'cond1', targetNodeId: 'action-false', sourceHandle: 'false' },
    { id: 'e3', sourceNodeId: 'action-true', targetNodeId: 'end1', sourceHandle: null },
  ];

  it('picks the edge matching the requested handle for a CONDITION node', () => {
    expect(pickNextEdge(edges, 'cond1', 'true')?.targetNodeId).toBe('action-true');
    expect(pickNextEdge(edges, 'cond1', 'false')?.targetNodeId).toBe('action-false');
  });

  it('picks the single outgoing edge when no handle is requested', () => {
    expect(pickNextEdge(edges, 'action-true')?.targetNodeId).toBe('end1');
  });

  it('returns undefined when there is no matching outgoing edge (a valid terminal)', () => {
    expect(pickNextEdge(edges, 'end1')).toBeUndefined();
    expect(pickNextEdge(edges, 'cond1', undefined)).toEqual(edges[0]);
  });
});

describe('interpolate', () => {
  it('replaces {{path}} placeholders with resolved values', () => {
    expect(interpolate('Hola {{contact.name}}, tu total es {{event.payload.total}}', {
      contact: { name: 'Ana' },
      event: { payload: { total: 99 } },
    })).toBe('Hola Ana, tu total es 99');
  });

  it('replaces an unresolvable placeholder with an empty string', () => {
    expect(interpolate('Hola {{contact.missing}}', { contact: {} })).toBe('Hola ');
  });
});
