# n8n Dev Geek Week 2026

## n8n Cloud Account

Whenever the user asks about n8n workflows, executions, credentials, or anything related to their n8n instance, **always use the `mcp__n8n__*` MCP tools** — do not use `curl` or the REST API directly.

The n8n MCP server is configured in `.claude/settings.json` and connects to `https://galamo.app.n8n.cloud`.

## Project overview

Self-hosted n8n with Docker Compose and PostgreSQL, plus a seed script for sample data.

- Local n8n: `http://localhost:5678`
- Seed script: `scripts/seed.js` — populates `dev_geek_week` database with users, cars, and user-car relations
- Run seed: `npm run seed` (requires Docker Compose to be running first)
