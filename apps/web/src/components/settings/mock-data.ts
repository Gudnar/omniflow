export const settingsTabs = [
  { key: 'general', label: 'General' },
  { key: 'ecommerce', label: 'Ecommerce' },
  { key: 'orders', label: 'Pedidos y entregas' },
  { key: 'bookings', label: 'Reservas y servicios' },
  { key: 'payments', label: 'Pagos' },
  { key: 'notifications', label: 'Notificaciones' },
  { key: 'users', label: 'Usuarios y permisos' },
  { key: 'integrations', label: 'Integraciones' },
];

export const operationTypes = [
  { key: 'direct', title: 'Venta directa', description: 'Solo venta de productos.', color: '#2563eb' },
  { key: 'booking', title: 'Reserva', description: 'Solo reservas de servicios.', color: '#16a34a' },
  { key: 'both', title: 'Venta + Reserva', description: 'Permite ventas y reservas.', color: '#dc2626' },
];

export const deliveryMethods = [
  { key: 'pickup', title: 'Retiro en sucursal', description: 'El cliente recoge en la sucursal.', checked: true },
  { key: 'delivery', title: 'Entrega a domicilio', description: 'Entregamos en la dirección del cliente.', checked: true },
  { key: 'shipping', title: 'Envíos por paquetería', description: 'Envíos a través de operadores logísticos.', checked: false },
];

export const locationSources = [
  { key: 'whatsapp', title: 'Obtener desde WhatsApp', description: 'El agente IA solicitará la ubicación por WhatsApp.', selected: true },
  { key: 'ecommerce', title: 'Obtener desde Ecommerce', description: 'El cliente autoriza su ubicación desde el ecommerce.', selected: false },
  { key: 'both', title: 'Permitir ambas opciones', description: 'Intentaremos obtenerla desde WhatsApp y si no, desde el ecommerce.', selected: false },
  { key: 'none', title: 'No solicitar ubicación', description: 'No se solicitará la ubicación al cliente.', selected: false },
];

export type IntegrationStatus = 'connected' | 'disconnected';

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  detailLabel: string;
  detailValue: string;
  actionLabel: string;
  color: string;
  emoji: string;
}

export const integrationCategories = [
  { key: 'all', label: 'Todas', count: 7 },
  { key: 'communication', label: 'Comunicación', count: 1 },
  { key: 'payments', label: 'Pagos', count: 2 },
  { key: 'logistics', label: 'Logística', count: 1 },
  { key: 'crm', label: 'CRM', count: 1 },
  { key: 'marketing', label: 'Marketing', count: 1 },
  { key: 'storage', label: 'Almacenamiento', count: 1 },
];

// Real messaging channels (WhatsApp/Instagram/Facebook/TikTok) are rendered
// by <ChannelsSection>, wired to the actual backend connections — they used
// to have a generic "WhatsApp Business API" mock entry here, removed to
// avoid showing two different WhatsApp cards with two different states.
export const integrations: Integration[] = [
  {
    id: 'payments-gateway',
    name: 'Pasarelas de pago',
    description: 'Recibe pagos en línea de forma segura con tus pasarelas preferidas.',
    category: 'payments',
    status: 'connected',
    detailLabel: 'Mercado Pago',
    detailValue: 'Cuenta activa',
    actionLabel: 'Administrar',
    color: '#3b82f6',
    emoji: '🏦',
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Obtén direcciones, calcula distancias y mejora tus rutas de entrega.',
    category: 'logistics',
    status: 'connected',
    detailLabel: 'API Key',
    detailValue: 'Alza••••••••••••••••',
    actionLabel: 'Configurar',
    color: '#ef4444',
    emoji: '📍',
  },
  {
    id: 'shipping',
    name: 'Envíos y logística',
    description: 'Integra operadores logísticos para cotizar y gestionar envíos automáticamente.',
    category: 'logistics',
    status: 'disconnected',
    detailLabel: '',
    detailValue: 'No conectado',
    actionLabel: 'Conectar',
    color: '#f59e0b',
    emoji: '🚚',
  },
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Sincroniza contactos, empresas y actividades con tu CRM.',
    category: 'crm',
    status: 'disconnected',
    detailLabel: '',
    detailValue: 'No conectado',
    actionLabel: 'Conectar',
    color: '#fb923c',
    emoji: '🧩',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sincroniza contactos y automatiza campañas de email marketing.',
    category: 'marketing',
    status: 'disconnected',
    detailLabel: '',
    detailValue: 'No conectado',
    actionLabel: 'Conectar',
    color: '#facc15',
    emoji: '🐵',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Almacena y comparte archivos de pedidos, facturas y documentos.',
    category: 'storage',
    status: 'disconnected',
    detailLabel: '',
    detailValue: 'No conectado',
    actionLabel: 'Conectar',
    color: '#3b82f6',
    emoji: '📁',
  },
  {
    id: 'webhook',
    name: 'Webhook personalizado',
    description: 'Envía y recibe datos en tiempo real a tu propio servidor vía webhooks.',
    category: 'communication',
    status: 'disconnected',
    detailLabel: '',
    detailValue: 'No conectado',
    actionLabel: 'Configurar',
    color: '#8b5cf6',
    emoji: '🔗',
  },
];
