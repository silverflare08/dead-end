import React, { useEffect, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, Check, ChevronRight, Clock3, FlaskConical, Ghost, History, Layers3, Play, Radio, ShieldCheck, ShoppingBag, Skull, Terminal, TriangleAlert, Zap } from 'lucide-react';
import { scenarios, type Experiment, type Scenario, type Service } from '../../packages/contracts.js';
import { CustomerView } from './CustomerView.js';

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request unsuccessful.');
  return data;
}
const shortId = (id: string) => id.slice(0, 8);
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function App() {
  const [scenario, setScenario] = useState<Scenario>('duplicate');
  const [runs, setRuns] = useState<Experiment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [page, setPage] = useState<'lab' | 'history' | 'guide'>('lab');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selected = runs.find(run => run.id === selectedId);
  const active = runs.some(run => run.status === 'running');
  const definition = scenarios.find(item => item.id === (selected?.scenario ?? scenario))!;
  const baseline = selected?.parentId ? runs.find(run => run.id === selected.parentId) : undefined;

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const data = await request<Experiment[]>('/api/experiments');
        if (!disposed) { setRuns(data); setConnected(true); }
      } catch { if (!disposed) setConnected(false); }
      finally { if (!disposed) timer = setTimeout(refresh, 500); }
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); };
  }, []);

  async function run(replay = false) {
    setSubmitting(true); setError('');
    try {
      const result = await request<Experiment>(replay ? `/api/experiments/${selected!.id}/replay` : '/api/experiments', replay ? {} : { scenario, mode: 'vulnerable' });
      setRuns(previous => [result, ...previous.filter(item => item.id !== result.id)]);
      setSelectedId(result.id); setPage('lab');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start experiment.'); }
    finally { setSubmitting(false); }
  }

  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); setPage('lab'); }}><span className="brand-icon"><Ghost size={24} /></span><span>dead<span className="brand-light">end</span><small>RESILIENCE LAB</small></span></a>
      <div className="workspace"><span className="workspace-icon">HC</span><div>Haunted Checkout<small>Sandbox project</small></div><ChevronRight size={15} /></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">
        <button className={page === 'lab' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('lab')}><FlaskConical size={18} /> Experiment lab <span className="nav-dot" /></button>
        <button className={page === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('history')}><History size={18} /> Run history <span className="count">{runs.length}</span></button>
        <button className={page === 'guide' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('guide')}><Layers3 size={18} /> Field guide</button>
      </nav>
      <div className="sidebar-bottom"><div className="edition"><Ghost size={28} /><strong>Nothing stays buried.</strong><p>Find the failure.<br />Understand the aftermath.</p><span>HACK-TO-WEEN / 2026</span></div><div className="runtime"><span className={connected ? 'status-dot' : 'status-dot offline'} />{connected ? 'Local backend connected' : 'Backend disconnected'}<small>v0.1 · local development</small></div></div>
    </aside>
    <main>
      <header className="topbar"><div>Workspace <ChevronRight size={13} /><span>{page === 'lab' ? 'Experiment lab' : page === 'history' ? 'Run history' : 'Field guide'}</span></div><span className="environment"><span className="status-dot" /> LOCAL SANDBOX</span></header>
      <div className="content">
        <div className="heading"><div><p className="eyebrow">CONTROLLED CHAOS. CLEAR EVIDENCE.</p><h1>{page === 'lab' ? <>Every system has<br className="mobile-break" /> a <em>breaking point.</em></> : page === 'history' ? 'Leave an evidence trail.' : 'Know what you’re testing.'}</h1><p className="subtitle">{page === 'lab' ? 'Find yours. Introduce a failure, trace the impact, and prove your protection works.' : page === 'history' ? 'Saved experiments from this local workspace. Open a run to inspect its evidence.' : 'Three bounded experiments. Real requests. Explicit limitations.'}</p></div><div className="heading-mark" aria-hidden="true"><Skull size={54} strokeWidth={1} /><span>EXPECT THE<br />UNEXPECTED</span></div></div>
        {error && <div role="alert" className="alert"><TriangleAlert size={16} />{error}<button onClick={() => setError('')}>Dismiss</button></div>}
        {!connected && <div role="status" className="alert">Connecting to the local backend. Start both services with npm run dev.</div>}
        {page === 'lab' && <>
          <div className="section-label"><span>01 / CHOOSE YOUR FAILURE</span><span>3 scenarios · bounded workloads</span></div>
          <div className="scenario-grid">{scenarios.map((item, index) => <button key={item.id} disabled={active || submitting} className={`scenario-card ${scenario === item.id ? 'selected' : ''}`} onClick={() => { setScenario(item.id); setSelectedId(undefined); }}><div className="scenario-top"><span className={`scenario-icon tone-${index}`}>{index === 0 ? <Ghost size={23} /> : index === 1 ? <Clock3 size={23} /> : <Radio size={23} />}</span><span className="scenario-number">0{index + 1}</span></div><h2>{item.title}</h2><p>{item.description}</p><div className="scenario-foot"><span>{item.protection}</span>{scenario === item.id ? <span className="selected-mark"><Check size={12} /></span> : <ArrowRight size={14} />}</div></button>)}</div>
          <CustomerView scenario={selected?.scenario ?? scenario} run={selected} disabled={!connected || active || submitting} onOrder={() => void run()} />
          <div className="lab-grid">
            <section className="panel map-panel"><div className="panel-title"><div><Activity size={17} /><h2>Haunted service map</h2></div><span className={`badge ${selected?.status === 'running' ? 'live' : ''}`}>{selected?.status === 'running' ? 'EXPERIMENT LIVE' : selected?.status === 'completed' ? 'RUN COMPLETE' : 'READY TO OBSERVE'}</span></div><ServiceMap run={selected} /><div className="map-caption"><span><span className="legend-dot green" />Recorded success</span><span><span className="legend-dot orange" />Recorded warning</span><span><span className="legend-dot gray" />No activity</span></div><div className="experiment-controls"><div><span className="micro-label">EXPERIMENT</span><strong>{definition.alias}</strong><small>{selected ? `${selected.mode} · ${shortId(selected.id)}` : 'Vulnerable baseline · isolated data'}</small></div><button className="primary" disabled={!connected || active || submitting} onClick={() => void run()}><Play size={15} fill="currentColor" />{active ? 'Running experiment…' : 'Cast a curse'}</button></div></section>
            <section className="panel hypothesis"><div className="panel-title"><div><ShieldCheck size={17} /><h2>The protection</h2></div><span className="step-tag">02</span></div><div className="shield-art"><ShieldCheck size={39} strokeWidth={1.3} /></div><h3>{definition.protection}</h3><p>{definition.criterion}</p><div className="hypothesis-note"><Zap size={15} /><span>Same workload. Fresh state.<br />One protection enabled.</span></div><button className="secondary" disabled={!selected || selected.status !== 'completed' || selected.mode !== 'vulnerable' || active || submitting} onClick={() => void run(true)}><ShieldCheck size={16} />Enable protection & replay<ArrowRight size={15} /></button><small className="hint">Complete a vulnerable baseline to unlock replay.</small></section>
          </div>
          <div className="section-label results-label"><span>03 / INSPECT THE AFTERMATH</span><span>{selected ? `RUN ${shortId(selected.id).toUpperCase()}` : 'Awaiting your first experiment'}</span></div>
          <div className="metrics">{[{ label: 'Requests sent', value: selected?.metrics.requests, icon: <Zap size={16} /> }, { label: 'Orders created', value: selected?.status === 'running' ? selected.orders.length : selected?.metrics.orders, icon: <ShoppingBag size={16} /> }, { label: 'Duplicates prevented', value: selected?.metrics.prevented, icon: <ShieldCheck size={16} /> }, { label: 'Checkout response p95', value: selected && selected.status !== 'running' ? `${selected.metrics.p95Ms} ms` : undefined, icon: <Clock3 size={16} /> }].map(metric => <div className="metric" key={metric.label}><span>{metric.label}{metric.icon}</span><strong>{metric.value ?? '—'}</strong></div>)}</div>
          {baseline && selected && <Comparison baseline={baseline} run={selected} />}
          {selected?.error && <div className="alert" role="alert">{selected.error}</div>}
          <section className="panel timeline"><div className="panel-title"><div><Terminal size={17} /><h2>Request evidence</h2><span className="event-count">{selected?.events.length ?? 0} events</span></div>{selected && selected.status !== 'running' && <a className="text-link" href={`/api/experiments/${selected.id}/report`} download><ArrowDownToLine size={14} />Export JSON</a>}</div>{!selected ? <div className="empty"><span className="empty-icon"><Terminal size={26} /></span><h3>Your evidence starts here.</h3><p>Run an experiment to see timestamped events from the backend.</p><span>NO FABRICATED METRICS. NO HIDDEN MAGIC.</span></div> : <div className="event-list" aria-label="Experiment events">{selected.events.map(event => <div className="event" key={event.id}><span className="event-time">+{event.elapsedMs} ms</span><span className={`event-indicator ${event.level}`} /><span className="event-service">{event.service}</span><div><strong>{event.kind}</strong><p>{event.detail}</p></div>{event.requestId && <code>{event.requestId}</code>}</div>)}</div>}</section>
          <p className="footnote">Local runtime · controlled payment provider · in-process retry worker. AWS deployment is a separate build milestone. Response percentiles describe this small demo workload, not a load test.</p>
        </>}
        {page === 'history' && <section className="panel history-panel">{runs.length === 0 ? <div className="empty"><History size={32} /><h3>No experiments yet.</h3><p>Run your first scenario in the experiment lab.</p><button className="primary" onClick={() => setPage('lab')}>Open experiment lab<ArrowRight size={16} /></button></div> : runs.map(run => <button className="history-row" key={run.id} onClick={() => { setSelectedId(run.id); setScenario(run.scenario); setPage('lab'); }}><span className="history-symbol"><FlaskConical size={20} /></span><div><strong>{scenarios.find(item => item.id === run.scenario)!.title}</strong><small>{shortId(run.id)} · {new Date(run.createdAt).toLocaleDateString()} {time(run.createdAt)}</small></div><span className="history-mode">{run.mode}</span><span className={`badge ${run.status === 'running' ? 'live' : ''}`}>{run.status}</span><ChevronRight size={18} /></button>)}</section>}
        {page === 'guide' && <div className="guide-grid"><section className="panel guide"><h2>Observe → protect → replay</h2><p>Start with a vulnerable baseline. The runner issues real HTTP requests to controlled local services. Each scenario records its own orders and events.</p><p>Replay creates an isolated experiment with the same workload and one protection enabled. The comparison links both runs, so the conclusion can be traced to evidence.</p><h3>What the metrics mean</h3><p><b>Duplicates prevented:</b> repeated checkout requests that reused the original operation.</p><p><b>Checkout response p95:</b> the nearest-rank 95th percentile of observed HTTP response times. With one or three requests, this is a demo measurement, not a performance benchmark.</p><p><b>Pending payment:</b> the checkout response budget expired. A later provider result reconciles the order.</p></section><section className="panel guide"><h2>Current boundaries</h2><p>The runtime binds to localhost. It is intended for a developer’s machine and must not be exposed as a public service.</p><p>Payments are simulated. Notifications go to a local sink. The retry worker and idempotency lock run in one process; they do not provide distributed durability.</p><p>Finished experiments persist to disk. A server restart marks unfinished experiments as interrupted.</p><h3>Next: the AWS runtime</h3><p>Replace local locks with conditional DynamoDB writes, local retry delivery with SQS, and local endpoints with Lambda. Add authenticated controls, deployment limits, and cloud integration tests before public release.</p></section></div>}
        <footer><span><Ghost size={14} /> DEAD END</span><span>Find what breaks. Prove what survives.</span><span>HACK-TO-WEEN 2026</span></footer>
      </div>
    </main>
  </div>;
}

function ServiceMap({ run }: { run?: Experiment }) {
  const nodes: { id: Service; title: string; subtitle: string; icon: React.ReactNode }[] = [
    { id: 'checkout', title: 'Checkout', subtitle: 'Order entry', icon: <ShoppingBag size={22} /> },
    { id: 'payment', title: 'Payment', subtitle: 'Controlled provider', icon: <Zap size={22} /> },
    { id: 'notification', title: 'Notification', subtitle: 'Receipt delivery', icon: <Radio size={22} /> },
  ];
  return <div className="service-map"><span className="map-coordinate">SANDBOX / HC-001</span><div className="map-nodes">{nodes.map((node, index) => {
    const last = run?.events.filter(event => event.service === node.id).at(-1);
    return <React.Fragment key={node.id}>{index > 0 && <span className="connector" aria-hidden="true"><ChevronRight size={14} /></span>}<div className={`service-node ${last?.level ?? 'idle'}`}><span className="node-icon">{node.icon}<i /></span><strong>{node.title}</strong><small>{node.subtitle}</small><span className="node-status">{!last ? 'NO ACTIVITY' : last.level === 'warn' ? 'WARNING' : last.level === 'success' ? 'SUCCESS' : 'OBSERVED'}</span></div></React.Fragment>;
  })}</div><div className="map-bottom"><span className="map-cross">+</span><span>Checkout calls payment and notification paths according to the scenario.</span><span className="map-cross">+</span></div></div>;
}

function Comparison({ baseline, run }: { baseline: Experiment; run: Experiment }) {
  if (run.status !== 'completed') return null;
  const rows = run.scenario === 'duplicate' ? [['Orders created', baseline.metrics.orders, run.metrics.orders], ['Duplicate orders', baseline.metrics.duplicateOrders, run.metrics.duplicateOrders]] : run.scenario === 'latency' ? [['Checkout response (ms)', baseline.metrics.p95Ms, run.metrics.p95Ms], ['Pending responses', baseline.metrics.timeouts, run.metrics.timeouts]] : [['Orders accepted', baseline.metrics.orders, run.metrics.orders], ['Notifications delivered', baseline.metrics.delivered, run.metrics.delivered]];
  return <section className="panel comparison"><div className="panel-title"><div><ShieldCheck size={17} /><h2>Same failure. Different outcome.</h2></div><span className="badge">PAIRED RUNS</span></div><table><caption className="sr-only">Baseline compared with protected replay</caption><thead><tr><th>Measured outcome</th><th>Vulnerable</th><th>Protected</th></tr></thead><tbody>{rows.map(row => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table><p>{run.scenario === 'latency' ? 'A shorter checkout response is not a faster payment. The protected run returned pending, then reconciled the late payment.' : 'Both runs use workload v1 and separate state. Export the report to inspect the underlying events.'}</p></section>;
}
