// IPC returns fresh JSON objects on each poll. Reuse unchanged branches so
// status reads do not invalidate every node, history row and graph draft.
// All fields, including timestamps, errors and unknown occupancy, remain exact.
export function shareUnchanged<T>(previous: T, incoming: T): T {
  if (Object.is(previous, incoming)) return previous;
  if (!previous || !incoming || typeof previous !== "object" || typeof incoming !== "object") return incoming;
  if (Array.isArray(previous) !== Array.isArray(incoming)) return incoming;
  const old = previous as Record<string, unknown>;
  const next = incoming as Record<string, unknown>;
  const keys = Object.keys(next);
  let unchanged = keys.length === Object.keys(old).length;
  const result: Record<string, unknown> = Array.isArray(incoming) ? [] as unknown as Record<string, unknown> : {};
  for (const key of keys) {
    const value = shareUnchanged(old[key], next[key]);
    Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
    if (!Object.hasOwn(old, key) || value !== old[key]) unchanged = false;
  }
  return unchanged ? previous : result as T;
}
