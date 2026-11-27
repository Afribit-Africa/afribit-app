import { describe, expect, it } from 'vitest';
import { featureDataDir } from '../src';

describe('featureDataDir', () => {
  it('builds a directory under an absolute POSIX root', () => {
    expect(featureDataDir('/data/app', 'chat')).toBe('/data/app/features/chat/');
  });

  it('builds a directory under an absolute file:// root', () => {
    expect(featureDataDir('file:///data/app', 'chat')).toBe('file:///data/app/features/chat/');
  });

  it('strips trailing slashes from the root, leaving exactly one trailing slash', () => {
    expect(featureDataDir('/data/app/', 'chat')).toBe('/data/app/features/chat/');
    expect(featureDataDir('/data/app///', 'chat')).toBe('/data/app/features/chat/');
    expect(featureDataDir('file:///data/app/', 'chat')).toBe('file:///data/app/features/chat/');
    expect(featureDataDir('file:///data/app///', 'chat')).toBe('file:///data/app/features/chat/');
  });

  it('accepts a feature id at the 64-character limit', () => {
    expect(featureDataDir('/data', 'a'.repeat(64))).toBe(`/data/features/${'a'.repeat(64)}/`);
  });

  it.each([
    ['a ".." path segment', '/data/../etc'],
    ['a ".." path segment in a file:// root', 'file:///data/../etc'],
    ['a root made only of slashes', '/'],
    ['a root made only of slashes (two)', '//'],
    ['a backslash', '/data\\app'],
    ['a control character', '/data\u0000app'],
    ['an empty root', ''],
    ['a relative path', 'data/app'],
    ['a file:// URI with no absolute path', 'file://data'],
  ])('rejects a root with %s', (_label, root) => {
    expect(() => featureDataDir(root, 'chat')).toThrow();
  });

  it.each([
    ['an empty id', ''],
    ['an over-long id', 'a'.repeat(65)],
    ['an uppercase id', 'Chat'],
    ['an id starting with a dot', '.chat'],
    ['an id with a dot inside', 'a.b'],
    ['an id with ".."', 'a..b'],
    ['an id with a slash', 'a/b'],
    ['an id with a backslash', 'a\\b'],
    ['an id starting with a separator', '-chat'],
  ])('rejects a feature id with %s', (_label, featureId) => {
    expect(() => featureDataDir('/data', featureId)).toThrow();
  });

  it('gives no two features a directory that is a prefix of another', () => {
    const dirs = ['chat', 'chat2', 'cha', 'wallet'].map((id) => featureDataDir('/data/app', id));
    for (const a of dirs) {
      for (const b of dirs) {
        if (a === b) continue;
        expect(b.startsWith(a)).toBe(false);
      }
    }
  });
});
