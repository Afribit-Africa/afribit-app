import { describe, expect, it } from 'vitest';
import { vaultKey } from '../src';

describe('vaultKey', () => {
  it('builds the namespaced storage key', () => {
    expect(vaultKey('chat', 'matrix.recovery.v1')).toBe('vault.chat.matrix.recovery.v1');
  });

  it('accepts a segment at the 64-character limit', () => {
    expect(vaultKey('a'.repeat(64), 'b'.repeat(64))).toBe(`vault.${'a'.repeat(64)}.${'b'.repeat(64)}`);
  });

  it.each([
    ['uppercase feature id', 'Chat', 'name'],
    ['feature id starting with a separator', '-chat', 'name'],
    ['feature id starting with a dot', '.chat', 'name'],
    ['empty feature id', '', 'name'],
    ['over-long feature id', 'a'.repeat(65), 'name'],
    ['uppercase name', 'chat', 'Name'],
    ['name with a space', 'chat', 'a b'],
    ['empty name', 'chat', ''],
    ['over-long name', 'chat', 'b'.repeat(65)],
  ])('rejects %s', (_label, featureId, name) => {
    expect(() => vaultKey(featureId, name)).toThrow();
  });

  it('rejects a feature id or name containing ".."', () => {
    expect(() => vaultKey('a..b', 'c')).toThrow();
    expect(() => vaultKey('a', 'b..c')).toThrow();
  });

  it('rejects a feature id with "." so it cannot share another feature\'s namespace', () => {
    // Without the check, vault.a.b.c would be reachable as feature 'a.b' + name 'c'
    // and as feature 'a' + name 'b.c'.
    expect(vaultKey('a', 'b.c')).toBe('vault.a.b.c');
    expect(() => vaultKey('a.b', 'c')).toThrow();
  });
});
