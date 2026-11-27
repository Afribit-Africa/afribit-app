import { describe, expect, it } from 'vitest';
import { createQrBridge } from '../src/shell/qrBridgeCore';

describe('contact QR bridge', () => {
  it('resolves a request with the scanned value', async () => {
    const bridge = createQrBridge();
    const pending = bridge.request();
    expect(bridge.pending()).toBe(true);
    bridge.resolve('afribit:contact:amina');
    await expect(pending).resolves.toBe('afribit:contact:amina');
    expect(bridge.pending()).toBe(false);
  });

  it('resolves the earlier request with null when a new one starts', async () => {
    const bridge = createQrBridge();
    const first = bridge.request();
    const second = bridge.request();
    await expect(first).resolves.toBeNull();
    bridge.resolve('second');
    await expect(second).resolves.toBe('second');
  });

  it('does nothing when there is no pending request', () => {
    const bridge = createQrBridge();
    expect(() => bridge.resolve('stray')).not.toThrow();
    expect(bridge.pending()).toBe(false);
  });

  it('reflects the pending state across a request and its resolve', async () => {
    const bridge = createQrBridge();
    expect(bridge.pending()).toBe(false);
    const pending = bridge.request();
    expect(bridge.pending()).toBe(true);
    bridge.resolve(null);
    expect(bridge.pending()).toBe(false);
    await expect(pending).resolves.toBeNull();
  });
});
