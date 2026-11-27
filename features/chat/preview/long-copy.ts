/** Review-only expansion. No language is translated or persisted. */
import { copy } from '../src/strings';
function expand(value: unknown): unknown {
  if (typeof value === 'string') return value + ' ~'.repeat(Math.ceil(value.length * 0.3 / 2));
  if (typeof value === 'function') return (...args: unknown[]) => expand(value(...args));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, expand(entry)]));
  return value;
}
export const longCopy = expand(copy) as typeof copy;
