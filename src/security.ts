import { createHash, timingSafeEqual } from 'node:crypto';

export function matchesToken(candidate: string, expected: string): boolean {
  return timingSafeEqual(createHash('sha256').update(candidate).digest(), createHash('sha256').update(expected).digest());
}
export function redactor(tokens: string[]): (text: string) => string {
  const secrets = [...new Set(tokens.flatMap(token => [token, JSON.stringify(token).slice(1, -1)]))]
    .filter(Boolean).sort((a, b) => b.length - a.length);
  return text => {
    let safe = text;
    for (const token of secrets) safe = safe.split(token).join('[REDACTED]');
    return safe;
  };
}
export function bearer(value: string | undefined): string {
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}
export function canonicalJSON(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, normalize(val)]));
    return item;
  };
  return JSON.stringify(normalize(value));
}
