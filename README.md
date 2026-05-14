# mjse2
# Screen to Sky (S2S)

Screen to Sky (S2S) is a 17-lesson PPL training application for X-Plane (C172 @ KHMP).  
This repo is the canonical application source for the S2S project: frontend, scoring engine, telemetry parsers, and FlyWithLua blackbox scripts.

## Quick summary
- Frontend: Next.js (App Router)
- Engine: lib/s2s-engine (TypeScript) — telemetry parser & graders
- Recorder: FlyWithLua scripts in `scripts/x-plane/FlyWithLua/Scripts`
- Safety: Scoring is 1–5 only. All telemetry/score changes require an Intent Ticket (see docs/spec.md) and paired tests.

## Getting started (developer)
Prerequisites:
- Node.js 18+ (LTS)
- pnpm or npm
- Git

Clone:
```bash
git clone <YOUR_REMOTE_URL>
cd <repo>