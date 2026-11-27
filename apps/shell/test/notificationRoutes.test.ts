import { describe, expect, it } from 'vitest';
import {
  isNewResponse,
  notificationData,
  targetFromData,
  type NotificationTarget,
} from '../src/shell/notificationRoutesCore';

const knownApp = (id: string) => id === 'chat';

describe('notificationData', () => {
  it('writes the app open key and app id for an app target', () => {
    expect(notificationData({ open: 'app', id: 'chat' })).toEqual({ afribitOpen: 'app', afribitApp: 'chat' });
  });

  it('writes only the passes open key for the passes target', () => {
    expect(notificationData({ open: 'passes' })).toEqual({ afribitOpen: 'passes' });
  });
});

describe('targetFromData', () => {
  const targets: readonly NotificationTarget[] = [{ open: 'app', id: 'chat' }, { open: 'passes' }];

  for (const target of targets) {
    it(`round-trips the ${target.open} target`, () => {
      expect(targetFromData(notificationData(target), knownApp)).toEqual(target);
    });
  }

  it('rejects an app id that is not in the registry', () => {
    expect(targetFromData({ afribitOpen: 'app', afribitApp: 'unknown' }, knownApp)).toBeNull();
  });

  it('rejects an empty app id', () => {
    expect(targetFromData({ afribitOpen: 'app', afribitApp: '' }, knownApp)).toBeNull();
  });

  it('rejects an app id longer than 64 characters', () => {
    expect(targetFromData({ afribitOpen: 'app', afribitApp: 'a'.repeat(65) }, () => true)).toBeNull();
  });

  it('rejects a non-string app id', () => {
    expect(targetFromData({ afribitOpen: 'app', afribitApp: 7 }, knownApp)).toBeNull();
  });

  it('rejects a free-form route payload', () => {
    expect(targetFromData({ afribitOpen: 'route', path: '/x' }, knownApp)).toBeNull();
  });

  it('rejects the app shape with no app id', () => {
    expect(targetFromData({ afribitOpen: 'app' }, knownApp)).toBeNull();
  });

  it('rejects null, a string, an array and an empty object', () => {
    expect(targetFromData(null, knownApp)).toBeNull();
    expect(targetFromData('afribitOpen', knownApp)).toBeNull();
    expect(targetFromData(['afribitOpen'], knownApp)).toBeNull();
    expect(targetFromData({}, knownApp)).toBeNull();
  });

  it('rejects a known shape carrying an extra key', () => {
    expect(targetFromData({ afribitOpen: 'passes', afribitApp: 'chat' }, knownApp)).toBeNull();
  });
});

describe('isNewResponse', () => {
  it('is true for a first response id', () => {
    expect(isNewResponse('response-1', null)).toBe(true);
  });

  it('is false once the same response id was handled', () => {
    expect(isNewResponse('response-1', 'response-1')).toBe(false);
  });

  it('is false for a null response id', () => {
    expect(isNewResponse(null, null)).toBe(false);
  });
});
