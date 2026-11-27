import { CHAT_GATE_ORIGIN } from '@afribit/kernel';
import { describe, expect, it } from 'vitest';
import { CHAT_GATE_ORIGINS } from '../src/shell/chatOrigins';

describe('chat signing origins', () => {
  it('allows only the fixed gate origin', () => {
    expect(CHAT_GATE_ORIGINS).toEqual(['https://chat-gate.mesh.afribit.africa']);
  });

  it('matches the gate origin Chat runs against', () => {
    expect(CHAT_GATE_ORIGINS).toEqual([CHAT_GATE_ORIGIN]);
  });
});
