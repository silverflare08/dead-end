# Dead End

Find what breaks. Prove what survives.

Dead End is a controlled resilience lab for a checkout system. Run a vulnerable workload, inspect its request evidence, enable a protection, and compare an isolated replay.

## Current release

Version 0.1 is a local development prototype. It includes a Halloween-themed React dashboard, a practice shop with recorded orders, plain-language outcome explanations, HTTP-based experiments, disk-backed run history, paired comparisons, and JSON evidence exports. It is **not yet the AWS submission build**.

| Scenario | Baseline | Protected replay |
| --- | --- | --- |
| Duplicate checkout | Three concurrent requests create three orders | A local idempotency lock returns one shared order |
| Payment latency | Checkout waits for the delayed provider | Checkout returns pending, then reconciles the late payment |
| Notification outage | Direct delivery fails without retry | A local worker retries until delivery recovers |

## Start

Requirements: Node.js 22.12 or newer and npm. Node.js 24 is suitable.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The API binds to http://127.0.0.1:3001. Run commands from this repository root. On PowerShell, use `npm.cmd` if script execution policy prevents invoking `npm`.

```bash
npm run check    # integration tests, TypeScript, frontend production build
npm start        # serves the API and previously built frontend on port 3001
```

The Vite development proxy expects the default API port, 3001. Update its proxy if you change the API port.

## Try it

1. Select **Duplicate checkout** and click **Place order & simulate 3 attempts** in the practice shop (or **Cast a curse** in the control panel).
2. See the three order cards and the explanation of why one intended purchase produced extra orders.
3. Click **Enable protection & replay**.
4. Compare three baseline orders with one protected order and two prevented duplicates.
5. Export the JSON report; it includes both runs and their event evidence.
6. Try payment latency and notification recovery.

## Structure

```text
apps/web/             React dashboard, service map, history, comparison
services/lab.ts       Local experiment API, runner, controlled service endpoints
services/server.ts    Local process entrypoint
packages/contracts.ts Shared types and scenario definitions
tests/                HTTP integration tests
docs/                 Architecture, build roadmap, GitHub and demo guides
infra/                AWS deployment specification for the next milestone
submission/           Submission checklist and presentation outline
```

## Evidence and semantics

Requests are real loopback HTTP calls. Payment processing is simulated; no real money moves. The local notification sink records delivery events. All dashboard metrics come from server records. Service colors reflect each service's last event, not a health probe.

Every experiment uses fresh state. Replay uses the same fixed workload (version 1), but scheduling and response timing can vary. Response p95 is calculated over one or three requests and is not a load-testing benchmark. A completed experiment means the workload finished, not that the vulnerable application passed a reliability criterion.

## Boundaries

- Local only: the server deliberately binds to loopback. Do not expose it through a public tunnel.
- The lock and retry worker are single-process implementations, not distributed or durable mechanisms.
- Order state exists in the experiment history. Finished runs persist under `.data/experiments.json`; a restart marks unfinished runs interrupted.
- Google Fonts is optional; system sans-serif fallbacks work without network access.
- Authentication, real SQS delivery, DynamoDB concurrency controls, public deployment, and the finished presentation remain on the roadmap.

See [the roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md), and [submission checklist](submission/CHECKLIST.md).
