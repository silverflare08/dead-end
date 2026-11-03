export type Scenario = 'duplicate' | 'latency' | 'notification';
export type Mode = 'vulnerable' | 'protected';
export type Service = 'runner' | 'checkout' | 'payment' | 'notification';
export interface TraceEvent {
  id: string; at: string; elapsedMs: number; service: Service;
  kind: string; detail: string; level: 'info' | 'warn' | 'success';
  requestId?: string;
}
export interface Order { id: string; key: string; status: 'confirmed' | 'pending'; }
export interface Metrics {
  requests: number; orders: number; duplicateOrders: number;
  delivered: number; prevented: number; durationMs: number;
  p95Ms: number; timeouts: number;
}
export interface Experiment {
  id: string; scenario: Scenario; mode: Mode; parentId?: string;
  createdAt: string; finishedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  events: TraceEvent[]; orders: Order[]; metrics: Metrics; error?: string;
}
export const scenarios: { id: Scenario; title: string; alias: string; description: string; protection: string; criterion: string }[] = [
  { id: 'duplicate', title: 'Duplicate checkout', alias: 'The double haunt',
    description: 'Three simultaneous requests. One customer intent. How many orders survive?',
    protection: 'Idempotency lock', criterion: 'Exactly one order for three identical checkout requests.' },
  { id: 'latency', title: 'Payment latency', alias: 'The lingering ghost',
    description: 'A payment response arrives late. Does checkout wait indefinitely or return an honest state?',
    protection: 'Bounded timeout', criterion: 'Checkout returns pending before payment completes; the late result is reconciled.' },
  { id: 'notification', title: 'Notification outage', alias: 'The silent messenger',
    description: 'The order is accepted while notifications are offline. Will the receipt eventually arrive?',
    protection: 'Retry queue', criterion: 'One order and one delivered notification after the service recovers.' },
];
