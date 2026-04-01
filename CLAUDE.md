# 超群签收 — chaoqun-sign

Digital delivery signing system for 西安超群粮油贸易有限公司.

## Project Overview

H5-based delivery receipt signing system that integrates with 金蝶云星辰 ERP and 飞书 (Lark).
Replaces paper triple-copy receipts with digital signatures while maintaining print capability.

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: Bull + Redis (print jobs, SMS)
- **Auth**: iron-session (admin), HMAC-SHA256 tokens (sign URLs)
- **SMS**: Aliyun SMS
- **Storage**: Aliyun OSS (signature images)
- **Styling**: Tailwind CSS 4 + shadcn/ui

## Build & Dev Commands

- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Type check: `pnpm typecheck`
- Test: `pnpm test`
- DB migrate (dev): `pnpm db:migrate`
- DB push: `pnpm db:push`
- DB studio: `pnpm db:studio`
- DB seed: `pnpm db:seed`

## Coding Conventions

- Language: TypeScript strict mode, ESM
- Chinese UI text, English code/variables/commits
- Immutable data patterns — never mutate, always return new objects
- All monetary amounts stored in 分 (cents) as integers, never floats
- Files under 500 LOC; extract helpers when growing
- Validate all external input (API, user, webhook) at boundaries
- Error messages: user-friendly in Chinese for UI, detailed English for logs

## Commit Messages

```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

## Integration Points

- **金蝶云星辰**: Sales outbound order data via Open API (bill query)
- **飞书 Lark**: Webhook notifications to 莱运 agent on sign completion
- **Aliyun SMS**: Send signing links to drivers/customers
- **Aliyun OSS**: Store signature images (private bucket, signed URLs)
- **MCP Printer**: Print delivery notes via network printer (192.168.1.222 HP or future 映美 FP-630KII+)

## Security

- Never hardcode secrets; use `.env.local`
- HMAC-SHA256 tokens for signing URLs (time-limited)
- Webhook signature verification for all inbound webhooks
- RBAC: admin, driver, viewer roles
- OSS private bucket with temporary signed URLs for signature images
- Rate limiting on all public endpoints

## File Organization

```
src/
  app/           — Next.js App Router pages & API routes
    api/         — REST API endpoints
    sign/        — H5 signing pages (public, token-auth)
    driver/      — Driver portal pages
    admin/       — Admin dashboard pages
  lib/           — Shared utilities
    db.ts        — Prisma client singleton
    auth.ts      — Session & token helpers
    sms.ts       — Aliyun SMS client
    oss.ts       — Aliyun OSS client
    kingdee.ts   — 金蝶 API client
    lark.ts      — 飞书 webhook client
    queue.ts     — Bull queue setup
  components/    — Reusable React components
    ui/          — shadcn/ui components
prisma/
  schema.prisma  — Database schema
  seed.ts        — Seed data
docs/
  architecture.md — System architecture
  plan.md        — Implementation milestones
```
