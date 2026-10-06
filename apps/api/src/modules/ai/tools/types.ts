// Phase 14: AI Commerce — the tool layer an AI agent uses to act on real
// ecommerce/booking data, per AI_SPEC.md's "Ecommerce tools"/"Booking
// tools" lists. Every tool here is a thin, validated wrapper around the
// SAME domain services the storefront/admin already use (CartsService,
// AppointmentsService, ...) — never a shortcut around them. This is the
// "Tool Policy → Authorization → Validation before domain service call"
// chain CLAUDE.md requires:
//   - Tool Policy: AiAgent.enabledTools — an admin (ai.manage) decides which
//     tools a given agent may even be offered.
//   - Authorization: tenant scoping is automatic (TenantContextService, same
//     as every other service); a contactId-owned-resource check (order,
//     appointment) happens inside each handler that reads/mutates one.
//   - Validation: each handler parses/checks its own arguments before ever
//     calling into a domain service — a malformed or hallucinated argument
//     fails here, never reaches Prisma.
export type ToolRiskLevel = 'read' | 'write' | 'critical';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  // If true, executing this tool ends the turn immediately — its own side
  // effect (e.g. sending a message) IS the reply; the model is never called
  // again and no separate text message follows. Used only by
  // send_storefront_link today.
  terminal?: boolean;
}

export interface ToolContext {
  tenantId: string;
  contactId: string;
  conversationId: string;
  agentId: string;
}

export interface ToolExecutionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}
