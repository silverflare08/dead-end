import path from 'node:path';
import { createLab } from './lab.js';

const lab = await createLab({ file: path.resolve('.data/experiments.json') });
const url = await lab.listen(Number(process.env.PORT ?? 3001));
console.log(`Dead End API: ${url}`);
console.log('Local runtime. Payments and retry delivery are controlled demo implementations.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await lab.close();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
