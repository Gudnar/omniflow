import { PrismaClient } from '../src/prisma';

const prisma = new PrismaClient();

async function main() {
  const permissions = [
    { code: 'tenant.manage', description: 'Manage tenant settings' },
    { code: 'users.read', description: 'Read users' },
    { code: 'users.manage', description: 'Create, update, delete users' },
    { code: 'roles.read', description: 'Read roles' },
    { code: 'roles.manage', description: 'Create, update, delete roles' },
    { code: 'branches.read', description: 'Read branches' },
    { code: 'branches.manage', description: 'Create, update, delete branches' },
    { code: 'contacts.read', description: 'Read contacts, notes, and activities' },
    { code: 'contacts.manage', description: 'Create, update, delete contacts, notes, and activities' },
    { code: 'companies.read', description: 'Read companies' },
    { code: 'companies.manage', description: 'Create, update, delete companies' },
    { code: 'tags.read', description: 'Read tags' },
    { code: 'tags.manage', description: 'Create, update, delete tags' },
    { code: 'conversations.read', description: 'Read conversations and messages' },
    { code: 'conversations.manage', description: 'Create conversations, post messages, change status/assignment' },
    { code: 'channels.read', description: 'Read channel connections (WhatsApp, Instagram, Facebook, TikTok)' },
    { code: 'channels.manage', description: 'Connect/disconnect channel integrations' },
    { code: 'ecommerce.read', description: 'Read ecommerce store configuration' },
    { code: 'ecommerce.manage', description: 'Update ecommerce store configuration, theme, sections, and publish' },
    { code: 'products.read', description: 'Read categories, products, variants, branch pricing/stock, and inventory movements/transfers' },
    { code: 'products.manage', description: 'Create/update/delete categories and products, manage branch pricing/stock, adjust inventory, and manage transfers' },
    { code: 'commerce.read', description: 'Read commerce sessions, carts, and customer addresses' },
    { code: 'commerce.manage', description: 'Create/update commerce sessions, carts, cart items, and checkout' },
    { code: 'orders.read', description: 'Read orders' },
    { code: 'orders.manage', description: 'Manage orders (reserved for Phase 11 order management)' },
    { code: 'booking.read', description: 'Read booking services, resources, schedules, and staff time-off' },
    { code: 'booking.manage', description: 'Manage booking services, resources, schedules, and staff time-off' },
    { code: 'appointments.read', description: 'Read appointments and availability' },
    { code: 'appointments.manage', description: 'Create/reschedule/cancel appointments and change their status' },
    { code: 'workflows.read', description: 'Read flows, flow versions, and flow executions' },
    { code: 'workflows.manage', description: 'Create, update, publish, and delete flows' },
    { code: 'templates.read', description: 'Read WhatsApp message templates and their approval status' },
    { code: 'templates.manage', description: 'Create, edit, submit for review, and delete message templates' },
    { code: 'campaigns.read', description: 'Read campaigns, segments, and recipients' },
    { code: 'campaigns.manage', description: 'Create, schedule, send, and delete campaigns and segments' },
    { code: 'payments.read', description: 'Read configured payment methods' },
    { code: 'payments.manage', description: 'Create, update, delete payment methods' },
    { code: 'ai.read', description: 'Read AI providers, models, agents, and usage' },
    { code: 'ai.manage', description: 'Create, update, delete AI agents' },
    { code: 'comments.read', description: 'Read Facebook Page posts and comments' },
    { code: 'comments.manage', description: 'Reply to Facebook Page comments' },
    { code: 'link-page.read', description: 'Read the public link-in-bio page and its links' },
    { code: 'link-page.manage', description: 'Create, update, and reorder the public link-in-bio page and its links' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log('✓ Permissions seeded successfully');

  // Global AI provider/model catalog (Phase 13: AI foundation) — shared
  // across every tenant, same "seed once, never tenant-scoped" treatment as
  // Permission itself. Only OpenAI has a real adapter wired up right now
  // (see apps/api/src/modules/ai/providers/openai.adapter.ts); Anthropic and
  // Gemini exist as catalog entries so the Agent form's provider list
  // matches AI_SPEC.md's documented set, with their models seeded INACTIVE
  // so they can't be picked until a real adapter exists for them.
  const providers = [
    {
      type: 'OPENAI' as const,
      label: 'OpenAI',
      models: [
        { name: 'gpt-4o-mini', label: 'GPT-4o mini', capabilities: ['text'], status: 'ACTIVE' as const },
        { name: 'gpt-4o', label: 'GPT-4o', capabilities: ['text', 'vision'], status: 'ACTIVE' as const },
      ],
    },
    {
      type: 'ANTHROPIC' as const,
      label: 'Anthropic',
      models: [
        { name: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', capabilities: ['text', 'vision'], status: 'INACTIVE' as const },
      ],
    },
    {
      type: 'GEMINI' as const,
      label: 'Google Gemini',
      models: [
        { name: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', capabilities: ['text', 'vision'], status: 'INACTIVE' as const },
      ],
    },
  ];

  for (const providerSeed of providers) {
    const provider = await prisma.aiProvider.upsert({
      where: { type: providerSeed.type },
      update: { label: providerSeed.label },
      create: { type: providerSeed.type, label: providerSeed.label },
    });

    for (const modelSeed of providerSeed.models) {
      await prisma.aiModel.upsert({
        where: { providerId_name: { providerId: provider.id, name: modelSeed.name } },
        update: { label: modelSeed.label, capabilities: modelSeed.capabilities, status: modelSeed.status },
        create: { providerId: provider.id, ...modelSeed },
      });
    }
  }

  console.log('✓ AI provider/model catalog seeded successfully');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
