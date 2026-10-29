import {readFileSync} from 'node:fs';
import {startEdge} from '../src/edge.js';
import type {EdgeConfig} from '../src/config.js';

const config = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as EdgeConfig;
const edge = await startEdge(config, () => {});
process.on('message', (input: {op:string;id?:string}) => {
  if (input.op === 'snapshot') process.send?.({id:input.id, outbox:edge.journal.outbox().length, counts:edge.journal.counts()});
  if (input.op === 'stop') void edge.close().then(() => process.disconnect?.());
});
process.send?.({ready:true});
