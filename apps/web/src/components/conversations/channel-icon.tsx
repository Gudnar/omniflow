'use client';

import { MessageCircle, Camera, ThumbsUp, Music2, Send, Globe } from 'lucide-react';
import { Channel, CHANNEL_COLORS } from './mock-data';

const CHANNEL_ICONS: Record<Channel, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  whatsapp: MessageCircle,
  instagram: Camera,
  facebook: ThumbsUp,
  tiktok: Music2,
  messenger: Send,
  webchat: Globe,
};

export function ChannelIcon({ channel, className = 'w-3 h-3' }: { channel: Channel; className?: string }) {
  const Icon = CHANNEL_ICONS[channel];
  return <Icon className={className} style={{ color: CHANNEL_COLORS[channel] }} />;
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  const Icon = CHANNEL_ICONS[channel];
  return (
    <span
      className="w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white"
      style={{ backgroundColor: CHANNEL_COLORS[channel] }}
    >
      <Icon className="w-2.5 h-2.5 text-white" />
    </span>
  );
}
