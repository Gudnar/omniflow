// Phase 13: AI foundation — same "worker just dispatches, the API does the
// real domain work" shape as flow-processor.ts's callInternalAction. The
// actual LLM call and message creation happen inside AiReplyService via the
// API's /internal/ai/reply, triggered from here off the hot webhook path.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';
const INTERNAL_SECRET = process.env.WORKER_INTERNAL_SECRET || 'dev-internal-secret';

export interface AiReplyJobData {
  tenantId: string;
  conversationId: string;
  // null — the proactive "welcome to web chat" greeting, with no real
  // customer message that triggered it. See AiReplyService.generateReply.
  messageId: string | null;
}

export async function processAiReplyJob(data: AiReplyJobData): Promise<void> {
  const response = await fetch(`${API_INTERNAL_URL}/internal/ai/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI reply action failed: ${response.status} ${text}`);
  }
}
