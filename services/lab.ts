import express from 'express';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { scenarios, type Experiment, type Mode, type Scenario, type Service } from '../packages/contracts.js';

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const requestSchema = z.object({ scenario: z.enum(['duplicate', 'latency', 'notification']), mode: z.enum(['vulnerable', 'protected']).default('vulnerable') }).strict();

export async function createLab(options: { file?: string; timingScale?: number } = {}) {
  const app = express();
  const runs = new Map<string, Experiment>();
  const locks = new Map<string, Promise<{ orderId: string }>>();
  const deliveries = new Set<string>();
  const starts = new Map<string, number>();
  const timings = new Map<string, number[]>();
  const tasks = new Set<Promise<unknown>>();
  const scale = options.timingScale ?? 1;
  let baseUrl = '';
  let server: Server | undefined;
  let saveChain = Promise.resolve();
  let persistenceError: string | undefined;

  if (options.file) {
    try {
      const saved = JSON.parse(await readFile(options.file, 'utf8')) as Experiment[];
      for (const run of saved) {
        if (run.status === 'running') { run.status = 'interrupted'; run.error = 'Server restarted before completion. Replay this scenario.'; }
        runs.set(run.id, run);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  function persist() {
    if (!options.file) return Promise.resolve();
    const file = options.file;
    const snapshot = JSON.stringify([...runs.values()], null, 2);
    saveChain = saveChain.then(async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(`${file}.tmp`, snapshot);
      await rename(`${file}.tmp`, file);
      persistenceError = undefined;
    }).catch(error => { persistenceError = String(error); console.error('Unable to save experiment history:', error); });
    return saveChain;
  }

  function track<T>(task: Promise<T>) {
    tasks.add(task);
    void task.finally(() => tasks.delete(task)).catch(() => {});
    return task;
  }

  function event(run: Experiment, service: Service, kind: string, detail: string, level: 'info' | 'warn' | 'success' = 'info', requestId?: string) {
    run.events.push({ id: randomUUID(), at: new Date().toISOString(), elapsedMs: Math.round(performance.now() - starts.get(run.id)!), service, kind, detail, level, requestId });
  }

  async function post(url: string, body: unknown, timeoutMs?: number) {
    const response = await fetch(`${baseUrl}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    return data;
  }

  async function createOrder(run: Experiment, key: string, requestId: string) {
    await pause(160 * scale);
    const orderId = randomUUID();
    run.orders.push({ id: orderId, key, status: 'confirmed' });
    event(run, 'checkout', 'order.created', `Order ${orderId.slice(0, 8)} committed.`, 'success', requestId);
    return { orderId };
  }

  app.disable('x-powered-by');
  app.use(express.json({ limit: '8kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: persistenceError ? 'degraded' : 'ok', runtime: 'local', storage: options.file ? 'disk' : 'memory', persistenceError }));
  app.get('/api/scenarios', (_req, res) => res.json(scenarios));
  app.get('/api/experiments', (_req, res) => res.json([...runs.values()].reverse()));
  app.get('/api/experiments/:id', (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) { res.status(404).json({ error: 'Experiment not found.' }); return; }
    res.json(run);
  });
  app.get('/api/experiments/:id/report', (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) { res.status(404).json({ error: 'Experiment not found.' }); return; }
    res.setHeader('Content-Disposition', `attachment; filename="dead-end-${run.id.slice(0, 8)}.json"`);
    res.json({ schemaVersion: 1, runtime: 'local', workloadVersion: 1, limitations: ['Single-process local runtime.', 'Queue and payment provider are controlled local implementations.', 'No AWS services are connected in this build.'], experiment: run, baseline: run.parentId ? runs.get(run.parentId) : undefined });
  });

  function start(scenario: Scenario, mode: Mode, parentId?: string) {
    const run: Experiment = { id: randomUUID(), scenario, mode, parentId, createdAt: new Date().toISOString(), status: 'running', events: [], orders: [], metrics: { requests: 0, orders: 0, duplicateOrders: 0, delivered: 0, prevented: 0, durationMs: 0, p95Ms: 0, timeouts: 0 } };
    runs.set(run.id, run);
    starts.set(run.id, performance.now());
    timings.set(run.id, []);
    event(run, 'runner', 'experiment.started', `${mode === 'protected' ? 'Protected' : 'Vulnerable'} run started. Workload v1; isolated state.`);
    void persist();
    track(execute(run));
    return run;
  }

  app.post('/api/experiments', (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Choose a valid scenario and mode.' }); return; }
    if ([...runs.values()].some(run => run.status === 'running')) { res.status(409).json({ error: 'An experiment is already running. Wait for it to finish.' }); return; }
    res.status(202).json(start(parsed.data.scenario, parsed.data.mode));
  });
  app.post('/api/experiments/:id/replay', (req, res) => {
    const parent = runs.get(req.params.id);
    if (!parent) { res.status(404).json({ error: 'Experiment not found.' }); return; }
    if (parent.status !== 'completed' || parent.mode !== 'vulnerable') { res.status(409).json({ error: 'Replay a completed vulnerable baseline.' }); return; }
    if ([...runs.values()].some(run => run.status === 'running')) { res.status(409).json({ error: 'An experiment is already running.' }); return; }
    res.status(202).json(start(parent.scenario, 'protected', parent.id));
  });

  // The internal endpoints are restricted to this loopback-only local process.
  const internalKey = randomUUID();
  app.use('/internal', (req, res, next) => {
    if (req.body?.token !== internalKey) { res.status(403).json({ error: 'Internal endpoint.' }); return; }
    if (!runs.has(req.body?.experimentId)) { res.status(404).json({ error: 'Unknown experiment.' }); return; }
    next();
  });
  const call = (url: string, run: Experiment, extra: Record<string, unknown> = {}, timeout?: number) => post(url, { token: internalKey, experimentId: run.id, ...extra }, timeout);

  app.post('/internal/payment', async (req, res) => {
    const run = runs.get(req.body.experimentId)!;
    event(run, 'payment', 'payment.requested', 'Simulated provider: response delayed by the experiment.', 'warn', req.body.requestId);
    await pause(1600 * scale);
    const order = run.orders.find(order => order.id === req.body.orderId);
    if (order) order.status = 'confirmed';
    event(run, 'payment', 'payment.completed', 'Provider completed the simulated payment; order reconciled as confirmed.', 'success', req.body.requestId);
    res.json({ status: 'confirmed' });
  });
  app.post('/internal/notification', (req, res) => {
    const run = runs.get(req.body.experimentId)!;
    if (performance.now() - starts.get(run.id)! < 1300 * scale) {
      event(run, 'notification', 'notification.unavailable', 'Delivery service returned HTTP 503.', 'warn');
      res.status(503).json({ error: 'Notification service is temporarily offline.' }); return;
    }
    if (!deliveries.has(run.id)) {
      deliveries.add(run.id); run.metrics.delivered++;
      event(run, 'notification', 'notification.delivered', 'Receipt delivered once to the local notification sink.', 'success');
    }
    res.json({ delivered: true });
  });
  app.post('/internal/checkout', async (req, res) => {
    const run = runs.get(req.body.experimentId)!;
    const requestId = req.body.requestId as string;
    event(run, 'checkout', 'checkout.started', 'Checkout request received.', 'info', requestId);
    if (run.scenario === 'duplicate') {
      const lockKey = `${run.id}:basket-001`;
      if (run.mode === 'protected') {
        if (locks.has(lockKey)) {
          run.metrics.prevented++;
          event(run, 'checkout', 'order.duplicate_prevented', 'Existing operation found for basket-001; returning its order.', 'success', requestId);
        } else locks.set(lockKey, createOrder(run, 'basket-001', requestId));
        res.json(await locks.get(lockKey));
      } else res.json(await createOrder(run, 'basket-001', requestId));
      return;
    }
    if (run.scenario === 'latency') {
      const orderId = randomUUID();
      run.orders.push({ id: orderId, key: 'basket-001', status: 'pending' });
      try {
        await call('/internal/payment', run, { orderId, requestId }, run.mode === 'protected' ? Math.max(100, 450 * scale) : undefined);
        res.json({ orderId, status: 'confirmed' });
      } catch (error) {
        if (!(error instanceof Error) || !['TimeoutError', 'AbortError'].includes(error.name)) throw error;
        run.metrics.timeouts++;
        event(run, 'checkout', 'payment.timeout', 'Response budget exceeded. Returning pending; payment outcome is not yet known.', 'warn', requestId);
        res.status(202).json({ orderId, status: 'pending' });
      }
      return;
    }
    const order = await createOrder(run, 'basket-001', requestId);
    if (run.mode === 'protected') {
      event(run, 'notification', 'notification.queued', 'Receipt accepted by the local retry worker.');
    } else {
      try { await call('/internal/notification', run); }
      catch { event(run, 'notification', 'notification.lost', 'Direct delivery failed. This vulnerable path has no retry.', 'warn'); }
    }
    res.json(order);
  });

  async function execute(run: Experiment) {
    try {
      await pause(300 * scale);
      const count = run.scenario === 'duplicate' ? 3 : 1;
      const responses = await Promise.allSettled(Array.from({ length: count }, async (_, index) => {
        run.metrics.requests++;
        const before = performance.now();
        await call('/internal/checkout', run, { requestId: `request-${index + 1}` });
        timings.get(run.id)!.push(performance.now() - before);
      }));
      const rejected = responses.find(result => result.status === 'rejected');
      if (rejected?.status === 'rejected') throw rejected.reason;
      if (run.scenario === 'notification' && run.mode === 'protected') {
        let delivered = false;
        for (let attempt = 1; attempt <= 6; attempt++) {
          event(run, 'notification', 'notification.attempt', `Retry worker delivery attempt ${attempt}.`);
          try { await call('/internal/notification', run); delivered = true; break; }
          catch { await pause(450 * scale); }
        }
        if (!delivered) throw new Error('Notification retry budget exhausted.');
      }
      if (run.scenario === 'latency') {
        const deadline = performance.now() + 2500 * scale;
        while (run.orders.some(order => order.status === 'pending') && performance.now() < deadline) await pause(50 * scale);
        if (run.orders.some(order => order.status === 'pending')) throw new Error('Payment reconciliation deadline exceeded.');
      }
      run.status = 'completed';
      event(run, 'runner', 'experiment.completed', 'Workload finished. Evidence is ready for inspection.', 'success');
    } catch (error) {
      run.status = 'failed'; run.error = error instanceof Error ? error.message : String(error);
      event(run, 'runner', 'experiment.failed', run.error, 'warn');
    } finally {
      run.finishedAt = new Date().toISOString();
      run.metrics.orders = run.orders.length;
      run.metrics.duplicateOrders = Math.max(0, run.orders.length - 1);
      run.metrics.durationMs = Math.round(performance.now() - starts.get(run.id)!);
      const sorted = timings.get(run.id)!.sort((a, b) => a - b);
      run.metrics.p95Ms = Math.round(sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0);
      locks.delete(`${run.id}:basket-001`);
      await persist();
    }
  }

  app.use(express.static(path.resolve('dist')));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error instanceof SyntaxError ? 400 : 500).json({ error: error instanceof SyntaxError ? 'Invalid JSON request.' : 'The request could not be completed.' });
  });
  return {
    app,
    async listen(port = 0) {
      server = await new Promise<Server>((resolve, reject) => { const listening = app.listen(port, '127.0.0.1', () => resolve(listening)); listening.on('error', reject); });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No local server address.');
      baseUrl = `http://127.0.0.1:${address.port}`;
      return baseUrl;
    },
    async close() {
      await Promise.allSettled([...tasks]);
      await saveChain;
      if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    },
  };
}
