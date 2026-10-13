import type { ClientConfig } from './config.js';
import { BridgeError } from './core.js';
export async function request<T>(config: ClientConfig, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(path, config.hubUrl), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: 'Bearer ' + config.token, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(config.requestTimeoutMs), redirect: 'error',
    });
  } catch { throw new BridgeError('NETWORK_UNAVAILABLE', 'Hub request failed or timed out', 503); }
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new BridgeError('INVALID_RESPONSE', 'Hub did not return JSON', 503); }
  if (!response.ok) {
    const error = (result as { error?: { code?: string; message?: string } })?.error;
    throw new BridgeError(error?.code || 'HUB_ERROR', error?.message || 'Hub request rejected', response.status);
  }
  return result as T;
}
