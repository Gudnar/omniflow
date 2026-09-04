# Deployment

Inicial: Linux VPS + Nginx + Node.js + pnpm + PM2 + PostgreSQL + Redis + S3-compatible.

Procesos separados: web, api, worker, scheduler.

No exponer PostgreSQL/Redis públicamente. Secrets fuera de git. TLS, firewall, SSH keys, least privilege.

Escalar API horizontalmente y workers por cola. PostgreSQL read replicas cuando sea necesario.

Backups automatizados y restauración probada. Métricas: CPU, RAM, latencia, errores, queue depth/latency, DB connections, Redis memory, AI usage/concurrency, webhook failures.

Migraciones mediante Prisma versionadas y revisadas.
