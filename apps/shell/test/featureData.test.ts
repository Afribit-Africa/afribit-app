import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  makeDirectoryAsync: vi.fn(async () => {}),
  deleteAsync: vi.fn(async () => {}),
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/africa.afribit.os/files/',
  makeDirectoryAsync: fs.makeDirectoryAsync,
  deleteAsync: fs.deleteAsync,
}));

import { ensureFeatureDataDir, wipeAllFeatureData } from '../src/shell/featureData';

const DOCUMENTS = 'file:///data/user/0/africa.afribit.os/files';

beforeEach(() => {
  fs.makeDirectoryAsync.mockClear();
  fs.deleteAsync.mockClear();
});

describe('ensureFeatureDataDir', () => {
  it('creates the feature directory under features/<id>/ and returns its URI', async () => {
    const uri = await ensureFeatureDataDir('chat');
    expect(uri).toBe(`${DOCUMENTS}/features/chat/`);
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(`${DOCUMENTS}/features/chat/`, { intermediates: true });
  });

  it('rejects a feature id that would share another feature\'s directory', async () => {
    await expect(ensureFeatureDataDir('chat.wallet')).rejects.toThrow();
    expect(fs.makeDirectoryAsync).not.toHaveBeenCalled();
  });
});

describe('wipeAllFeatureData', () => {
  it('deletes the whole features tree idempotently', async () => {
    await wipeAllFeatureData();
    expect(fs.deleteAsync).toHaveBeenCalledWith(`${DOCUMENTS}/features/`, { idempotent: true });
  });
});
