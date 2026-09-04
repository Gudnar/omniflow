import { Button } from '@omniflow/ui';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center space-y-8">
          <h1 className="text-5xl font-bold text-white">
            OmniFlow
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Multi-tenant SaaS platform for CRM, omnichannel conversations, AI agents,
            conversational ecommerce, and booking management.
          </p>

          <div className="space-y-4 pt-8">
            <h2 className="text-2xl font-semibold text-white">
              Phase 1: Foundation
            </h2>
            <div className="bg-slate-800 rounded-lg p-6 max-w-2xl mx-auto text-left">
              <ul className="text-slate-300 space-y-2">
                <li>✓ Monorepo setup (pnpm + Turbo)</li>
                <li>✓ Next.js frontend (App Router)</li>
                <li>✓ NestJS backend API</li>
                <li>✓ Prisma ORM + PostgreSQL</li>
                <li>✓ Redis + BullMQ setup</li>
                <li>✓ Shared packages (types, utils, ui, config)</li>
                <li>✓ TypeScript strict mode</li>
                <li>✓ ESLint + Prettier</li>
                <li>✓ Health check endpoint</li>
                <li>✓ Tests setup (Jest)</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 space-y-4">
            <p className="text-slate-400">
              Setup complete. Next phase: Authentication & Multi-tenancy
            </p>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
