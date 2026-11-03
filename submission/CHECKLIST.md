# Hack-to-ween submission

## Required by the supplied brief

- [x] Halloween-themed UI in the local prototype.
- [ ] At least one working AWS service integration.
- [ ] Working submission MVP with a tested access path for judges.
- [ ] Uploaded PPT explaining the idea, solution, and implementation.

## Recommended evidence

- [ ] Public or judge-accessible demo link tested from a fresh session.
- [ ] Repository with setup and deployment instructions.
- [ ] Actual before/after results for all three experiments.
- [ ] AWS architecture diagram and resource evidence.
- [ ] Backup video recorded from the real application.
- [ ] Known limitations and sample sizes stated accurately.

## Presentation outline

1. Problem: successful happy-path testing hides failure behavior.
2. Users: small development teams and students learning reliable systems.
3. Solution: introduce failure, inspect evidence, protect, replay.
4. Demo: duplicate checkout before and after idempotency.
5. AWS architecture and the role of each integrated service.
6. Implementation: request isolation, deduplication, pending payments, retry delivery.
7. Measured results and limitations.
8. Next steps: trace waterfall, configurable experiments, CI regression checks.

## Three-minute demo

- 0:00–0:25: Explain the customer problem: one intent can create several orders.
- 0:25–1:10: Run duplicate checkout and inspect its three recorded orders.
- 1:10–1:50: Enable protection, replay, and show one order with two duplicates prevented.
- 1:50–2:25: Demonstrate notification outage and eventual delivery.
- 2:25–3:00: Show the comparison report and actual AWS architecture.

Do not describe the local retry worker as SQS. Update the walkthrough when the AWS runtime is deployed and verified.
