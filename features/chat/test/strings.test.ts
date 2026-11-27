import { describe, expect, it } from 'vitest';
import { chatStrings, copy, swahili, type ChatStrings } from '../src/strings';

type Entry = readonly [string, unknown];

const entries = (value: unknown): Entry[] => Object.entries(value as Record<string, unknown>);

function shape(value: unknown): unknown {
  if (typeof value === 'function') return 'function';
  if (value === null || typeof value !== 'object') return typeof value;
  return Object.fromEntries(entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, shape(child)]));
}

function leaves(value: unknown, path = ''): { path: string; value: unknown }[] {
  return entries(value).flatMap(([key, child]) => {
    const next = path ? `${path}.${key}` : key;
    return child !== null && typeof child === 'object' ? leaves(child, next) : [{ path: next, value: child }];
  });
}

describe('Chat strings', () => {
  it('has exactly the English keys, including statuses, paymentStatuses and errors', () => {
    expect(shape(swahili)).toEqual(shape(copy));
  });

  it('translates every string and function to non-empty Kiswahili', () => {
    for (const { path, value } of leaves(swahili)) {
      if (typeof value === 'function') {
        const render = value as (...args: (string | number)[]) => unknown;
        const rendered = render('Amina', 3, 'Habari', '10:00');
        expect(typeof rendered, path).toBe('string');
        expect(String(rendered).trim(), path).not.toBe('');
      } else {
        expect(typeof value, path).toBe('string');
        expect(String(value).trim(), path).not.toBe('');
      }
    }
  });

  it('returns the English copy for en and the Kiswahili draft for sw', () => {
    expect(chatStrings('en')).toBe(copy);
    expect(chatStrings('sw')).toBe(swahili);
  });

  it('leaves at most 20% of the top-level strings identical to English', () => {
    const top = Object.keys(copy).flatMap(key => {
      const english: unknown = copy[key as keyof ChatStrings];
      return typeof english === 'string' ? [[key, english] as const] : [];
    });
    const translated = top.filter(([key, english]) => {
      const value: unknown = swahili[key as keyof ChatStrings];
      return typeof value === 'string' && value !== english;
    });
    expect(translated.length / top.length).toBeGreaterThanOrEqual(0.8);
  });
});