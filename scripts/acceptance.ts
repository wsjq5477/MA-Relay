import { runAcceptance, writeReport } from '../tests/harness.js';
const report = await runAcceptance();
writeReport(report);
console.log(JSON.stringify(report, null, 2));
