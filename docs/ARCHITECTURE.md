# Architecture

## Local runtime

The browser uses a Vite proxy to call the Express API. The controller creates isolated experiments. The runner sends HTTP requests to internal checkout endpoints guarded by a per-process token. Service events become the dashboard's evidence.

```text
React dashboard → Experiment API → Workload runner
                                      ↓ HTTP
                                  Checkout
                                  /      \
                            Payment   Notification
                                      /      \
                                direct path  retry worker

Experiment events and outcomes → in-memory records → atomic JSON snapshot
```

The map's three nodes summarize observed events, not independent deployed services. In this local build, the endpoints share one process. This makes development straightforward while preserving HTTP failure behavior.

## Concurrency

Duplicate checkout uses a promise registered before any asynchronous order creation. Identical concurrent requests wait on the same operation. This only protects one process. The AWS runtime must use conditional database operations and request fingerprints.

## Payment timeout

The order begins pending. The simulated provider completes after a configured delay. The protected checkout has a shorter response budget and returns HTTP 202 with pending status when that budget expires. The provider's eventual result updates the existing order. The experiment waits for reconciliation before reporting completion.

## Notifications

The direct path attempts delivery once during an outage. The protected path records queued work and retries through the runner. It is intentionally a local worker, not durable queue infrastructure. The cloud version must use an outbox and SQS, plus idempotent consumption.

## Persistence

Snapshots are serialized and atomically renamed to avoid concurrent file corruption. This is a local history store rather than a transactional order database. Interrupted runs are marked on restart; in-flight work is not recovered automatically.

## Cloud target

CloudFront + S3 serve the frontend. API Gateway exposes authenticated control routes. Separate Lambda handlers perform control, workload execution, checkout, controlled payment, and notifications. DynamoDB holds experiment state, orders, operation keys, and an outbox. SQS delivers notification work; a dead-letter queue captures exhausted retries. CloudWatch stores structured logs.

The control plane must be scoped to the bundled sandbox. The first release will not accept arbitrary destination URLs or infrastructure targets.
