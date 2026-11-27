/**
 * The image-picker core (C1): pure orchestration over the native image edges, so the
 * resize and EXIF-stripping rules are testable without Expo. It always re-encodes to
 * JPEG, which drops EXIF (including location); the picker's original file is never
 * returned.
 */
import type { PickedImage } from './nativeMatrix';

export interface ImageApi {
  /** Opens the system photo picker for one image. null when the user cancels. */
  choose(): Promise<{ uri: string; width: number; height: number } | null>;
  /** Re-encodes as JPEG at `compress` (0..1), scaled so neither side exceeds `maxDimension`. */
  encodeJpeg(uri: string, size: { width: number; height: number }, maxDimension: number, compress: number): Promise<{ uri: string; width: number; height: number }>;
  /** File size in bytes. */
  bytes(uri: string): Promise<number>;
}

type Limits = { maxDimension: number; maxBytes: number; allowedTypes: readonly string[] };

/** Compress levels tried in order; the first result within `maxBytes` wins. */
const COMPRESS_STEPS = [0.8, 0.6, 0.4] as const;

export function createPickImage(api: ImageApi): (limits: Limits) => Promise<PickedImage | null> {
  return async (limits) => {
    if (!limits.allowedTypes.includes('image/jpeg')) throw new Error('image/jpeg is the only supported image type');
    const chosen = await api.choose();
    if (!chosen) return null;
    const encode = async (compress: number) => {
      const encoded = await api.encodeJpeg(chosen.uri, { width: chosen.width, height: chosen.height }, limits.maxDimension, compress);
      return { ...encoded, bytes: await api.bytes(encoded.uri) };
    };
    let encoded = await encode(COMPRESS_STEPS[0]);
    for (const compress of COMPRESS_STEPS.slice(1)) {
      if (encoded.bytes <= limits.maxBytes) break;
      encoded = await encode(compress);
    }
    return { path: encoded.uri, mimeType: 'image/jpeg', width: encoded.width, height: encoded.height, bytes: encoded.bytes };
  };
}
