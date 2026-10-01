export type Channel = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'messenger' | 'webchat';

export const CHANNEL_COLORS: Record<Channel, string> = {
  whatsapp: '#22c55e',
  instagram: '#c026d3',
  facebook: '#2563eb',
  tiktok: '#111827',
  messenger: '#3b82f6',
  webchat: '#6366f1',
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  messenger: 'Messenger',
  webchat: 'Chat web',
};
