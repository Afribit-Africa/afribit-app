import { describe, expect, it } from 'vitest';
import { appendAlert, MAX_ENTRIES, parseAlertLog, serializeAlertLog, type AlertEntry } from '../src/shell/alertLogCore';

const knownApp = (id: string) => id === 'chat';

const entry = (id: string, overrides: Partial<AlertEntry> = {}): AlertEntry => ({
  id,
  at: 1_700_000_000_000,
  sender: 'Chat',
  title: 'New message',
  target: { open: 'app', id: 'chat' },
  ...overrides,
});

describe('appendAlert', () => {
  it('puts the newest entry first', () => {
    const log = appendAlert(appendAlert([], entry('a')), entry('b'));
    expect(log.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('caps the log at MAX_ENTRIES, dropping the oldest', () => {
    let log: readonly AlertEntry[] = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) log = appendAlert(log, entry(`id-${i}`));
    expect(log).toHaveLength(MAX_ENTRIES);
    expect(log[0]?.id).toBe(`id-${MAX_ENTRIES + 4}`);
    expect(log.some((e) => e.id === 'id-0')).toBe(false);
  });

  it('ignores an entry whose id is already in the log', () => {
    const log = appendAlert(appendAlert([], entry('a', { title: 'first' })), entry('a', { title: 'second' }));
    expect(log).toHaveLength(1);
    expect(log[0]?.title).toBe('first');
  });
});

describe('parseAlertLog', () => {
  it('returns an empty log for null or garbage', () => {
    expect(parseAlertLog(null, knownApp)).toEqual([]);
    expect(parseAlertLog('x', knownApp)).toEqual([]);
    expect(parseAlertLog('{}', knownApp)).toEqual([]);
    expect(parseAlertLog('[1]', knownApp)).toEqual([]);
  });

  it('drops entries that are missing fields', () => {
    const raw = JSON.stringify([{ id: 'a' }, { id: 'b', at: 1, sender: 's', title: 't' }]);
    expect(parseAlertLog(raw, knownApp).map((e) => e.id)).toEqual(['b']);
  });

  it('nulls a target naming an app that is not in the registry', () => {
    const raw = JSON.stringify([entry('a', { target: { open: 'app', id: 'gone' } })]);
    expect(parseAlertLog(raw, knownApp)[0]?.target).toBeNull();
  });

  it('nulls a free-form route target', () => {
    const raw = JSON.stringify([{ id: 'a', at: 1, sender: 's', title: 't', target: { open: 'route', path: '/x' } }]);
    expect(parseAlertLog(raw, knownApp)[0]?.target).toBeNull();
  });

  it('keeps a known app target, a passes target and a null target', () => {
    const log = [entry('a'), entry('b', { target: { open: 'passes' } }), entry('c', { target: null })];
    expect(parseAlertLog(serializeAlertLog(log), knownApp)).toEqual(log);
  });

  it('drops a body key that a stored entry carries', () => {
    const raw = JSON.stringify([{ ...entry('a'), body: 'private message preview' }]);
    const log = parseAlertLog(raw, knownApp);
    expect(log[0]).toEqual(entry('a'));
    expect(log[0]).not.toHaveProperty('body');
  });
});

describe('serializeAlertLog', () => {
  it('round-trips the entries', () => {
    const log = [entry('a'), entry('b', { at: 5, sender: 'Mesh', title: 'Pass expiring', target: { open: 'passes' } })];
    expect(parseAlertLog(serializeAlertLog(log), knownApp)).toEqual(log);
  });
});
