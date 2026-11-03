import type { Experiment } from './contracts.js';

export interface Outcome {
  verdict: 'waiting' | 'passed' | 'failed' | 'inconclusive';
  title: string;
  explanation: string;
}

export function explainOutcome(run?: Experiment): Outcome {
  if (!run) return { verdict: 'waiting', title: 'Ready for a practice order', explanation: 'Choose a problem, place the demo order, and see what the shop actually records.' };
  if (run.status === 'running') return { verdict: 'waiting', title: 'The drill is running', explanation: 'The shop is processing the requests. The result will appear when the drill finishes.' };
  if (run.status !== 'completed') return { verdict: 'inconclusive', title: 'This drill did not finish', explanation: 'There is not enough completed evidence to judge the protection. Start a fresh run.' };

  if (run.scenario === 'duplicate') {
    const passed = run.metrics.requests === 3 && run.orders.length === 1 && run.orders[0].status === 'confirmed';
    return {
      verdict: passed ? 'passed' : 'failed',
      title: passed ? 'One purchase, one order. Correct.' : 'One purchase became extra orders.',
      explanation: `The customer wanted one mug. Three checkout requests produced ${run.orders.length} order${run.orders.length === 1 ? '' : 's'}.${passed ? ' The repeated requests reused the original order.' : ' The shop treated repeated requests as separate purchases.'}`,
    };
  }
  if (run.scenario === 'latency') {
    const timeout = run.events.find(event => event.kind === 'payment.timeout');
    const completion = run.events.find(event => event.kind === 'payment.completed');
    const passed = !!timeout && !!completion && timeout.elapsedMs < completion.elapsedMs && run.orders.length === 1 && run.orders[0].status === 'confirmed';
    return {
      verdict: passed ? 'passed' : 'failed',
      title: passed ? 'The customer got an early update.' : 'The customer had to keep waiting.',
      explanation: passed ? 'The shop first said “payment pending.” When the delayed payment finished, it confirmed the same order. It did not pretend the payment had failed.' : 'The shop waited for the delayed payment before replying. The order may succeed, but the quick-response protection was not demonstrated.',
    };
  }
  const passed = run.orders.length === 1 && run.metrics.delivered === 1;
  return {
    verdict: passed ? 'passed' : 'failed',
    title: passed ? 'The receipt arrived after recovery.' : 'The order exists, but the receipt was lost.',
    explanation: passed ? 'The shop kept the delivery job and tried again after the notification service recovered. One demo receipt was delivered.' : 'The shop accepted the order, but its only attempt to send the receipt failed. There was no retry to recover it.',
  };
}
