import { describe, expect, it, vi } from 'vitest';
import { createScreenSecurity, type ScreenCaptureApi } from '../src/shell/screenSecurityCore';

function fakeApi(overrides: Partial<ScreenCaptureApi> = {}): { api: ScreenCaptureApi; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    api: {
      prevent: vi.fn(async (key: string) => { calls.push(`prevent:${key}`); }),
      allow: vi.fn(async (key: string) => { calls.push(`allow:${key}`); }),
      ...overrides,
    },
  };
}

describe('createScreenSecurity', () => {
  it('prevents on enable and allows on disable', async () => {
    const { api, calls } = fakeApi();
    const screenSecurity = createScreenSecurity(api);
    await screenSecurity('chat', true);
    expect(api.prevent).toHaveBeenCalledTimes(1);
    expect(api.prevent).toHaveBeenCalledWith('chat');
    await screenSecurity('chat', false);
    expect(api.allow).toHaveBeenCalledTimes(1);
    expect(api.allow).toHaveBeenCalledWith('chat');
    expect(calls).toEqual(['prevent:chat', 'allow:chat']);
  });

  it('does not call the api when the owner is already in the requested state', async () => {
    const { api } = fakeApi();
    const screenSecurity = createScreenSecurity(api);
    await screenSecurity('chat', true);
    await screenSecurity('chat', true);
    expect(api.prevent).toHaveBeenCalledTimes(1);
    await screenSecurity('chat', false);
    await screenSecurity('chat', false);
    expect(api.allow).toHaveBeenCalledTimes(1);
  });

  it('keeps owners independent', async () => {
    const { api, calls } = fakeApi();
    const screenSecurity = createScreenSecurity(api);
    await screenSecurity('chat', true);
    await screenSecurity('wallet', true);
    await screenSecurity('chat', false);
    expect(calls).toEqual(['prevent:chat', 'prevent:wallet', 'allow:chat']);
    await screenSecurity('wallet', false);
    expect(calls).toEqual(['prevent:chat', 'prevent:wallet', 'allow:chat', 'allow:wallet']);
  });

  it('leaves an owner unprotected and rethrows when prevent rejects', async () => {
    const { api } = fakeApi({ prevent: vi.fn(async () => { throw new Error('prevent-failed'); }) });
    const screenSecurity = createScreenSecurity(api);
    await expect(screenSecurity('chat', true)).rejects.toThrow('prevent-failed');
    // Still unprotected, so disabling is a no-op.
    await screenSecurity('chat', false);
    expect(api.allow).not.toHaveBeenCalled();
  });

  it('leaves an owner protected and rethrows when allow rejects', async () => {
    let fail = false;
    const { api } = fakeApi({ allow: vi.fn(async () => { if (fail) throw new Error('allow-failed'); }) });
    const screenSecurity = createScreenSecurity(api);
    await screenSecurity('chat', true);
    fail = true;
    await expect(screenSecurity('chat', false)).rejects.toThrow('allow-failed');
    // Still protected, so enabling again is a no-op and a later disable retries.
    await screenSecurity('chat', true);
    expect(api.prevent).toHaveBeenCalledTimes(1);
    fail = false;
    await screenSecurity('chat', false);
    expect(api.allow).toHaveBeenCalledTimes(2);
  });

  it('serialises calls for one owner so enable then disable ends disabled', async () => {
    const { api, calls } = fakeApi();
    const screenSecurity = createScreenSecurity(api);
    await Promise.all([screenSecurity('chat', true), screenSecurity('chat', false)]);
    expect(calls).toEqual(['prevent:chat', 'allow:chat']);
  });

  it('recovers the chain after a rejected call', async () => {
    let fail = true;
    const api: ScreenCaptureApi = {
      prevent: vi.fn(async () => { if (fail) throw new Error('prevent-failed'); }),
      allow: vi.fn(async () => undefined),
    };
    const screenSecurity = createScreenSecurity(api);
    await expect(screenSecurity('chat', true)).rejects.toThrow('prevent-failed');
    fail = false;
    await screenSecurity('chat', true);
    await screenSecurity('chat', false);
    expect(api.prevent).toHaveBeenCalledTimes(2);
    expect(api.allow).toHaveBeenCalledTimes(1);
  });
});
