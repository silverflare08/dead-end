# Build roadmap

## 1. Local foundation — implemented

- Responsive experiment dashboard with Halloween styling.
- Three controlled HTTP scenarios with vulnerable and protected modes.
- Isolated replay, recorded request events, metrics, saved history, and report export.
- Integration tests for concurrent duplicate requests, late payment reconciliation, notification recovery, input validation, and persistence.

## 2. AWS runtime — next required milestone

- Split controller, runner, checkout, payment, and notification into Lambda handlers.
- Define API Gateway, DynamoDB, SQS, dead-letter queue, and CloudWatch resources in CDK.
- Replace process-local locks with conditional DynamoDB writes and explicit operation states.
- Preserve request fingerprints so a reused idempotency key with a different payload returns a conflict.
- Use a transactional outbox for accepted orders and notification work; publishing can be retried without losing accepted work.
- Make notification delivery idempotent; test duplicate queue deliveries and exhausted retry budgets.
- Add scoped authentication, API throttling, request limits, maximum experiment duration, resource tags, and a deployment teardown command.
- Run equivalent integration checks against the deployed environment.

Acceptance: a hosted experiment can demonstrate real DynamoDB state and an SQS recovery path, with request IDs linking the UI to CloudWatch logs.

## 3. Product depth — high-value additions

1. **Hypothesis verdicts:** explicit per-scenario pass/fail criteria backed by events. Separate experiment completion from application resilience.
2. **Trace waterfall:** request-level timelines showing time spent waiting, retrying, and reconciling.
3. **Controlled configuration:** bounded latency, retry count, and concurrency. Save the complete configuration with each run.
4. **Circuit breaker experiment:** demonstrate opening, cooldown, and half-open recovery with measured downstream request counts.
5. **Failure expiry and stop control:** cancel future workload requests, expire fault settings, and let already accepted operations reconcile.
6. **CI regression mode:** run a fixed scenario suite from a CLI and return a nonzero exit code when an invariant fails.
7. **Printable evidence report:** readable paired results with workload configuration and links to request traces.

Implement the first three after AWS integration. Add circuit breakers and CI only when the required submission is stable.

## 4. Release quality

- Keyboard and mobile checks, contrast review, clear loading/error states.
- History pagination and data retention for long-lived deployments.
- Crash/restart tests, distributed concurrency tests, and notification redelivery tests.
- A fresh-clone setup rehearsal and a deployment rehearsal.
- Dependency/security review and no credentials or runtime data in Git.
- Benchmark claims include sample sizes and measured conditions.

## 5. Submission

- Working hosted URL and repository setup instructions.
- Eight-slide PPT with actual implementation and measured results.
- A three-minute live demo script and a recording of a real run.
- Screenshots of actual AWS resources with sensitive information excluded.

## Deliberately outside the first release

Arbitrary production targets, multi-cloud orchestration, automatic code changes, billing, and a large plugin ecosystem. They would make the core demonstration harder to finish and verify.
