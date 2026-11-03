# AWS implementation milestone

This folder currently contains the deployment specification, not a deployable stack. No AWS resources have been created.

## Prerequisites

- An AWS account with an appropriate deployment role.
- AWS CLI and a locally configured profile (prefer temporary SSO credentials where available).
- A chosen region supporting the required services.
- A small development budget and resource cleanup plan.

Do not put credentials in source code or commit a credentials file.

## Required resources

| Resource | Purpose |
| --- | --- |
| S3 and CloudFront | Static frontend hosting |
| API Gateway | Authenticated experiment controls |
| Lambda functions | Controller, runner, checkout, payment, notification, outbox publisher |
| DynamoDB | Experiment records, events, orders, idempotency operations, outbox |
| SQS and dead-letter queue | Retried notification delivery and exhausted attempts |
| CloudWatch | Structured logs and operational alarms |

## Acceptance tests before release

1. Concurrent calls across Lambda instances produce one protected order.
2. Reusing an idempotency key with a changed request is rejected.
3. An accepted order remains recoverable if outbox publication fails.
4. Duplicate queue deliveries do not repeat the notification effect.
5. A delayed payment result reconciles the existing order after checkout times out.
6. Experiment settings expire and cannot affect other experiment IDs.
7. A user cannot access another user's experiment.
8. Infrastructure can be removed through the documented teardown process.
