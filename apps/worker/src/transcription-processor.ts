// Phase 26: Voice/audio transcription — same "worker just dispatches, the
// API does the real domain work" shape as ai-processor.ts. The actual
// download + Whisper call + reply handoff happen inside
// AiTranscriptionService via the API's /internal/ai/transcribe.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';
const INTERNAL_SECRET = process.env.WORKER_INTERNAL_SECRET || 'dev-internal-secret';

export interface TranscriptionJobData {
  tenantId: string;
  messageId: string;
}

export async function processTranscriptionJob(data: TranscriptionJobData): Promise<void> {
  const response = await fetch(`${API_INTERNAL_URL}/internal/ai/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Transcription action failed: ${response.status} ${text}`);
  }
}
