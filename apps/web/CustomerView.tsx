import { Ghost, ShoppingBag, CheckCircle2, TriangleAlert, Clock3 } from 'lucide-react';
import type { Experiment, Scenario } from '../../packages/contracts.js';
import { explainOutcome } from '../../packages/outcome.js';
import './customer.css';

const explanations: Record<Scenario, { problem: string; protection: string; button: string }> = {
  duplicate: {
    problem: 'A customer wants one mug, but checkout sends the same request three times—as if they clicked again because the shop seemed slow.',
    protection: 'Remember the first request, so repeats return the same order.',
    button: 'Place order & simulate 3 attempts',
  },
  latency: {
    problem: 'The payment service takes too long to reply. The customer is left wondering whether their order went through.',
    protection: 'Reply “payment pending” promptly, then update the order when the payment finishes.',
    button: 'Place order with a slow payment',
  },
  notification: {
    problem: 'The order goes through, but the service that sends the receipt is temporarily unavailable.',
    protection: 'Keep the delivery job and try again when the service recovers.',
    button: 'Place order while receipts are offline',
  },
};

export function CustomerView({ scenario, run, disabled, onOrder }: {
  scenario: Scenario;
  run?: Experiment;
  disabled: boolean;
  onOrder: () => void;
}) {
  const story = explanations[scenario];
  const outcome = explainOutcome(run);
  const OutcomeIcon = outcome.verdict === 'passed' ? CheckCircle2 : outcome.verdict === 'failed' ? TriangleAlert : Clock3;

  return <section className="panel customer-view" aria-labelledby="customer-title">
    <div className="panel-title">
      <div><ShoppingBag size={17} /><h2 id="customer-title">See it as a customer</h2></div>
      <span className="badge">PRACTICE SHOP · NO REAL CHARGE</span>
    </div>
    <div className="customer-grid">
      <div className="demo-basket">
        <div className="mug-illustration" aria-hidden="true"><Ghost size={36} strokeWidth={1.5} /></div>
        <div><span className="micro-label">HAUNTED CHECKOUT</span><h3>Midnight ghost mug</h3><p>Quantity: 1 · Demo price: ₹499</p></div>
        <div className="basket-total"><span>One intended purchase</span><strong>₹499</strong></div>
        <button className="primary order-button" disabled={disabled} onClick={onOrder}><ShoppingBag size={16} />{story.button}</button>
        <small>Starts a fresh unprotected drill. Use “Enable protection & replay” below to compare.</small>
      </div>
      <div className="customer-story">
        <span className="micro-label">WHAT WE ARE TESTING</span><p>{story.problem}</p>
        <span className="micro-label">HOW THE PROTECTION HELPS</span><p>{story.protection}</p>
        <div className={`outcome outcome-${outcome.verdict}`} role="status" aria-live="polite">
          <OutcomeIcon size={20} /><div><strong>{outcome.title}</strong><p>{outcome.explanation}</p></div>
        </div>
      </div>
    </div>
    {run && <div className="customer-orders">
      <div className="order-list-heading"><strong>What the shop recorded</strong><span>{run.mode === 'protected' ? 'Protection on' : 'Protection off'} · {run.orders.length} order{run.orders.length === 1 ? '' : 's'}</span></div>
      {run.orders.length === 0 ? <p className="no-orders">No orders recorded yet.</p> : <ul>{run.orders.map(order => <li key={order.id}><ShoppingBag size={15} /><span>Ghost mug × 1<small>Order {order.id.slice(0, 8)}</small></span><span className={`order-state ${order.status}`}>{order.status === 'pending' ? 'Payment pending' : 'Confirmed'}</span></li>)}</ul>}
      <small>These are practice order records. They are not bank charges; this drill isolates one shop behavior at a time.</small>
    </div>}
  </section>;
}
