/**
 * The Expo binding for the image-picker core (C1): the system photo picker, JPEG
 * re-encoding through expo-image-manipulator (which drops EXIF), and file size from
 * expo-file-system.
 */
import { getInfoAsync } from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import type { NativeMatrixDeps } from './nativeMatrix';
import { createPickImage, type ImageApi } from './pickImageCore';

const api: ImageApi = {
  async choose() {
    const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: false, exif: false, quality: 1 });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
  },

  async encodeJpeg(uri, size, maxDimension, compress) {
    const context = ImageManipulator.manipulate(uri);
    if (Math.max(size.width, size.height) > maxDimension) {
      if (size.width >= size.height) context.resize({ width: maxDimension });
      else context.resize({ height: maxDimension });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  },

  async bytes(uri) {
    const info = await getInfoAsync(uri);
    if (!info.exists) throw new Error('picked image is missing');
    return info.size;
  },
};

/** Passed to the Chat natives so `sendEncryptedImage` can pick, resize and strip location. */
export const pickImage: NonNullable<NativeMatrixDeps['pickImage']> = createPickImage(api);
