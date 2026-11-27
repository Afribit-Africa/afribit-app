import { describe, expect, it, vi } from 'vitest';
import { createPickImage, type ImageApi } from '../src/chat/pickImageCore';

const limits = { maxDimension: 1600, maxBytes: 1_000_000, allowedTypes: ['image/jpeg'] as const };

/** Mirrors the Expo binding: JPEG re-encode, scaling the longer side down to `maxDimension`. */
function fakeApi(overrides: Partial<ImageApi> = {}): ImageApi {
  return {
    choose: vi.fn(async () => ({ uri: 'file:///original.heic', width: 800, height: 600 })),
    encodeJpeg: vi.fn(async (_uri, size, maxDimension, compress) => {
      const longer = Math.max(size.width, size.height);
      const scale = longer > maxDimension ? maxDimension / longer : 1;
      return { uri: `file:///encoded-${compress}.jpg`, width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
    }),
    bytes: vi.fn(async () => 100_000),
    ...overrides,
  };
}

describe('createPickImage', () => {
  it('returns null when the user cancels', async () => {
    const api = fakeApi({ choose: vi.fn(async () => null) });
    await expect(createPickImage(api)(limits)).resolves.toBeNull();
    expect(api.encodeJpeg).not.toHaveBeenCalled();
  });

  it('re-encodes even a small image and never returns the original file', async () => {
    const api = fakeApi();
    const picked = await createPickImage(api)(limits);
    expect(api.encodeJpeg).toHaveBeenCalledTimes(1);
    expect(picked).toEqual({ path: 'file:///encoded-0.8.jpg', mimeType: 'image/jpeg', width: 800, height: 600, bytes: 100_000 });
    expect(picked?.path).not.toBe('file:///original.heic');
  });

  it('scales a large image so its longer side is maxDimension', async () => {
    const api = fakeApi({ choose: vi.fn(async () => ({ uri: 'file:///original.jpg', width: 4000, height: 2000 })) });
    const picked = await createPickImage(api)(limits);
    expect(picked?.width).toBe(1600);
    expect(picked?.height).toBe(800);
  });

  it('steps the compress level down until the result fits maxBytes', async () => {
    const sizes = [3_000_000, 1_500_000, 500_000];
    const levels: number[] = [];
    const api = fakeApi({
      encodeJpeg: vi.fn(async (_uri, size, maxDimension, compress) => {
        levels.push(compress);
        const longer = Math.max(size.width, size.height);
        const scale = longer > maxDimension ? maxDimension / longer : 1;
        return { uri: `file:///encoded-${compress}.jpg`, width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
      }),
      bytes: vi.fn(async () => sizes.shift() ?? 0),
    });
    const picked = await createPickImage(api)(limits);
    expect(levels).toEqual([0.8, 0.6, 0.4]);
    expect(picked?.path).toBe('file:///encoded-0.4.jpg');
    expect(picked?.bytes).toBe(500_000);
  });

  it('returns the last attempt when nothing fits within maxBytes', async () => {
    const api = fakeApi({ bytes: vi.fn(async () => 9_000_000) });
    const picked = await createPickImage(api)(limits);
    expect(api.encodeJpeg).toHaveBeenCalledTimes(3);
    expect(picked).toEqual({ path: 'file:///encoded-0.4.jpg', mimeType: 'image/jpeg', width: 800, height: 600, bytes: 9_000_000 });
  });

  it('throws when the allowed types do not include image/jpeg', async () => {
    const api = fakeApi();
    await expect(createPickImage(api)({ ...limits, allowedTypes: ['image/png'] })).rejects.toThrow('image/jpeg is the only supported image type');
    expect(api.choose).not.toHaveBeenCalled();
  });
});
