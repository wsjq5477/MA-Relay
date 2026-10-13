const { EventEmitter } = require('node:events');
const { TextDecoder } = require('node:util');

const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_QUEUE_BYTES = 8 * 1024 * 1024;
const failure = (code, message) => Object.assign(new Error(message), { code });

function encodeFrame(value, limit = MAX_FRAME_BYTES) {
  let json;
  try { json = JSON.stringify(value); } catch { throw failure('PROTOCOL_JSON', '协议消息无法序列化。'); }
  if (typeof json !== 'string') throw failure('PROTOCOL_JSON', '协议消息必须是 JSON 对象。');
  const data = Buffer.from(json, 'utf8');
  if (!data.length || data.length > limit) throw failure('PROTOCOL_LIMIT', '协议消息超过单帧限制，请分页读取。');
  const frame = Buffer.allocUnsafe(data.length + 4);
  frame.writeUInt32BE(data.length, 0); data.copy(frame, 4);
  return frame;
}

/** Decode complete UTF-8 frames, regardless of transport chunk boundaries. */
class FrameDecoder extends EventEmitter {
  constructor(options = {}) {
    super(); this.limit = options.maxFrameBytes || MAX_FRAME_BYTES;
    this.header = Buffer.alloc(4); this.headerBytes = 0;
    this.payload = null; this.payloadBytes = 0; this.failed = false;
    this.decoder = new TextDecoder('utf-8', { fatal: true });
  }
  push(chunk) {
    if (this.failed) return;
    if (!Buffer.isBuffer(chunk)) chunk = Buffer.from(chunk);
    let offset = 0;
    try {
      while (offset < chunk.length) {
        if (!this.payload) {
          const size = Math.min(4 - this.headerBytes, chunk.length - offset);
          chunk.copy(this.header, this.headerBytes, offset, offset + size);
          this.headerBytes += size; offset += size;
          if (this.headerBytes !== 4) continue;
          const length = this.header.readUInt32BE(0);
          if (!length || length > this.limit) throw failure('PROTOCOL_LIMIT', '无效的协议帧长度。');
          this.payload = Buffer.allocUnsafe(length); this.payloadBytes = 0;
        }
        const size = Math.min(this.payload.length - this.payloadBytes, chunk.length - offset);
        chunk.copy(this.payload, this.payloadBytes, offset, offset + size);
        this.payloadBytes += size; offset += size;
        if (this.payloadBytes !== this.payload.length) continue;
        let value;
        try { value = JSON.parse(this.decoder.decode(this.payload)); }
        catch { throw failure('PROTOCOL_JSON', '后台返回无效的 UTF-8 JSON。'); }
        this.payload = null; this.payloadBytes = 0; this.headerBytes = 0;
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure('PROTOCOL_JSON', '协议帧必须是 JSON 对象。');
        this.emit('frame', value);
      }
    } catch (error) { this.failed = true; this.emit('error', error); }
  }
  end() {
    if (!this.failed && (this.headerBytes || this.payload)) {
      this.failed = true; this.emit('error', failure('PROTOCOL_TRUNCATED', '后台通道在完整消息到达前断开；请查询原请求。'));
    }
  }
}

/** A bounded writer; do not hide a blocked SSH channel in an unlimited queue. */
class FramedStream extends EventEmitter {
  constructor(stream, options = {}) {
    super(); this.stream = stream; this.closed = false; this.queue = [];
    this.queueBytes = 0; this.blocked = false; this.endRequested = false;
    this.maxQueueBytes = options.maxQueueBytes || MAX_QUEUE_BYTES;
    this.decoder = new FrameDecoder(options);
    this.decoder.on('frame', frame => this.emit('frame', frame));
    this.decoder.on('error', error => this.fail(error));
    stream.on('data', chunk => this.decoder.push(chunk));
    stream.on('end', () => this.decoder.end());
    stream.on('error', error => this.fail(error));
    stream.on('close', () => this.finish());
    stream.on('drain', () => { this.blocked = false; this.flush(); });
  }
  send(value) {
    if (this.closed || this.endRequested) throw failure('DAEMON_TRANSPORT', '后台连接已关闭；请查询原请求。');
    const data = encodeFrame(value, this.decoder.limit);
    if (this.queueBytes + (this.stream.writableLength || 0) + data.length > this.maxQueueBytes) throw failure('PROTOCOL_BACKPRESSURE', '后台通道繁忙，待发送数据达到上限。');
    this.queue.push(data); this.queueBytes += data.length; this.flush();
  }
  flush() {
    while (!this.closed && !this.blocked && this.queue.length) {
      const data = this.queue.shift(); this.queueBytes -= data.length;
      this.blocked = !this.stream.write(data);
    }
    if (this.endRequested && !this.queue.length && !this.closed) this.stream.end();
  }
  end() { this.endRequested = true; this.flush(); }
  fail(error) { if (this.closed) return; this.emit('error', error); this.stream.destroy(); this.finish(); }
  finish() { if (this.closed) return; this.closed = true; this.queue = []; this.queueBytes = 0; this.emit('close'); }
  close() { this.stream.destroy(); this.finish(); }
}

module.exports = { MAX_FRAME_BYTES, MAX_QUEUE_BYTES, encodeFrame, FrameDecoder, FramedStream };
