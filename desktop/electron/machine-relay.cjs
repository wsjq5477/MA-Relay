const net = require('node:net');
const { FrameDecoder } = require('./machine-protocol.cjs');
const { inspectDaemon, parseArguments, safeError } = require('./machine-daemon.cjs');

/** A transport-only process. Its lifetime never owns or cancels daemon work. */
async function runRelay(options, streams = {}) {
  const info = await inspectDaemon(options, streams.inspectTimeoutMs || 1500);
  if (options.expectedDaemonId && options.expectedDaemonId !== info.daemonId) throw Object.assign(new Error('此地址的后台身份已变化，停止连接。'), { code: 'MACHINE_IDENTITY_CHANGED' });
  const input = streams.input || process.stdin, output = streams.output || process.stdout;
  const socket = net.createConnection(info.socketPath);
  const incoming = new FrameDecoder(), outgoing = new FrameDecoder();
  return new Promise((resolve, reject) => {
    let done = false, inputEnded = false;
    const finish = error => {
      if (done) return; done = true;
      input.unpipe(socket); socket.unpipe(output);
      input.removeListener('data', inputChunk); input.removeListener('end', inputEnd); input.removeListener('error', onError);
      output.removeListener('error', onError);
      socket.destroy(); error ? reject(error) : resolve(info);
    };
    const onError = error => finish(error);
    const inputChunk = chunk => incoming.push(chunk);
    const inputEnd = () => { inputEnded = true; incoming.end(); };
    incoming.on('error', onError); outgoing.on('error', onError);
    input.on('error', onError); output.on('error', onError);
    // A data listener starts flowing a buffered stream. Keep it paused until
    // the socket pipe exists, otherwise the first hello can be consumed early.
    input.pause(); input.on('data', inputChunk); input.on('end', inputEnd);
    socket.on('data', chunk => outgoing.push(chunk));
    socket.once('error', onError);
    socket.once('end', () => { outgoing.end(); if (!done) finish(); });
    socket.once('close', () => { if (!done) finish(inputEnded ? null : Object.assign(new Error('远端后台通道已关闭；请查询原请求。'), { code: 'DAEMON_TRANSPORT' })); });
    socket.once('connect', () => {
      // Node pipe applies read/write backpressure; no unbounded relay buffer.
      input.pipe(socket); socket.pipe(output, { end: false });
      if (input.readableEnded) socket.end();
    });
  });
}

if (require.main === module) {
  void runRelay(parseArguments(process.argv.slice(2))).catch(error => {
    process.stderr.write(JSON.stringify({ error: safeError(error) }) + '\n'); process.exitCode = 1;
  });
}

module.exports = { runRelay };
