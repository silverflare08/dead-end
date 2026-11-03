import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLab } from '../services/lab.js';
import type { Experiment, Scenario } from '../packages/contracts.js';
import { explainOutcome } from '../packages/outcome.js';

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function finish(url: string, id: string): Promise<Experiment> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const run = await fetch(`${url}/api/experiments/${id}`).then(response => response.json()) as Experiment;
    if (run.status !== 'running') { assert.equal(run.status, 'completed', run.error); return run; }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Experiment did not complete.');
}

test('concurrent duplicate requests create three vulnerable orders but one protected order', async () => {
  const lab = await createLab({ timingScale: .3 }); const url = await lab.listen();
  try {
    const baseline = await post(`${url}/api/experiments`, { scenario: 'duplicate' });
    const conflict = await post(`${url}/api/experiments`, { scenario: 'duplicate' });
    assert.equal(conflict.status, 409);
    const original = await finish(url, baseline.data.id);
    assert.equal(original.metrics.orders, 3); assert.equal(original.metrics.duplicateOrders, 2);
    assert.equal(explainOutcome(original).verdict, 'failed');
    const replay = await post(`${url}/api/experiments/${original.id}/replay`, {});
    const protectedRun = await finish(url, replay.data.id);
    assert.equal(protectedRun.metrics.orders, 1); assert.equal(protectedRun.metrics.prevented, 2);
    assert.equal(explainOutcome(protectedRun).verdict, 'passed');
    assert.equal(explainOutcome({ ...protectedRun, status: 'interrupted' }).verdict, 'inconclusive');
    assert.equal(protectedRun.parentId, original.id);
    assert.equal(new Set(protectedRun.events.filter(event => event.kind === 'checkout.started').map(event => event.requestId)).size, 3);
    const report = await fetch(`${url}/api/experiments/${protectedRun.id}/report`).then(response => response.json());
    assert.equal(report.baseline.id, original.id); assert.equal(report.runtime, 'local');
  } finally { await lab.close(); }
});

test('timeout returns pending and a late payment reconciles the order without creating another', async () => {
  const lab = await createLab({ timingScale: .4 }); const url = await lab.listen();
  try {
    const baseline = await post(`${url}/api/experiments`, { scenario: 'latency' });
    const original = await finish(url, baseline.data.id);
    const replay = await post(`${url}/api/experiments/${original.id}/replay`, {});
    const run = await finish(url, replay.data.id);
    assert.equal(run.metrics.timeouts, 1); assert.equal(run.orders.length, 1);
    assert.equal(run.orders[0].status, 'confirmed');
    assert.ok(run.metrics.p95Ms < original.metrics.p95Ms);
    const timeout = run.events.findIndex(event => event.kind === 'payment.timeout');
    const payment = run.events.findIndex(event => event.kind === 'payment.completed');
    assert.ok(timeout >= 0 && payment > timeout);
    assert.equal(explainOutcome(original).verdict, 'failed');
    assert.equal(explainOutcome(run).verdict, 'passed');
    assert.equal(explainOutcome({ ...run, events: run.events.filter(event => event.kind !== 'payment.completed') }).verdict, 'failed');
  } finally { await lab.close(); }
});

test('retry delivery recovers after the outage while direct delivery is lost', async () => {
  const lab = await createLab({ timingScale: .3 }); const url = await lab.listen();
  try {
    const baseline = await post(`${url}/api/experiments`, { scenario: 'notification' });
    const original = await finish(url, baseline.data.id);
    assert.equal(original.metrics.delivered, 0); assert.equal(original.metrics.orders, 1);
    const replay = await post(`${url}/api/experiments/${original.id}/replay`, {});
    const run = await finish(url, replay.data.id);
    assert.equal(run.metrics.delivered, 1); assert.equal(run.metrics.orders, 1);
    assert.ok(run.events.filter(event => event.kind === 'notification.attempt').length > 1);
    assert.equal(explainOutcome(original).verdict, 'failed');
    assert.equal(explainOutcome(run).verdict, 'passed');
  } finally { await lab.close(); }
});

test('invalid inputs and unknown experiments are rejected', async () => {
  const lab = await createLab(); const url = await lab.listen();
  try {
    assert.equal((await post(`${url}/api/experiments`, { scenario: 'unknown' })).status, 400);
    assert.equal((await post(`${url}/api/experiments`, { scenario: 'duplicate', count: 10000 })).status, 400);
    assert.equal((await fetch(`${url}/api/experiments/missing`)).status, 404);
    assert.equal((await post(`${url}/api/experiments/missing/replay`, {})).status, 404);
    assert.equal((await post(`${url}/internal/checkout`, {})).status, 403);
  } finally { await lab.close(); }
});

test('completed evidence survives a server restart', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dead-end-test-'));
  const file = path.join(directory, 'history.json');
  let lab = await createLab({ file, timingScale: .1 });
  try {
    const url = await lab.listen();
    const started = await post(`${url}/api/experiments`, { scenario: 'duplicate' satisfies Scenario });
    await finish(url, started.data.id);
    await lab.close();
    lab = await createLab({ file });
    const restarted = await lab.listen();
    const saved = await fetch(`${restarted}/api/experiments/${started.data.id}`).then(response => response.json());
    assert.equal(saved.status, 'completed'); assert.equal(saved.metrics.orders, 3);
  } finally { await lab.close(); await rm(directory, { recursive: true, force: true }); }
});
