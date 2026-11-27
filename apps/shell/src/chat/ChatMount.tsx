import ChatApp, { chatStrings, createChatRuntime } from '@afribit/feature-chat';
import type { FeatureProps } from '@afribit/feature-sdk';
import Constants from 'expo-constants';
import { getRandomBytes } from 'expo-crypto';
import { deleteAsync } from 'expo-file-system/legacy';
import { useMemo } from 'react';
import { createChatHost } from '../shell/chatHost';
import { createChatDeps, type ChatNatives } from './chatDeps';
import { createNativeMatrixPort } from './nativeMatrix';
import { pickImage } from './pickImage';

const APP_VERSION = Constants.expoConfig?.version;

/**
 * Mounts the real Chat app (C1) with the shell host and the native Matrix engine,
 * replacing the locked placeholder. ChatApp starts and disposes the runtime itself,
 * so this only wires the dependencies and renders. The port and runtime are rebuilt
 * when `ctx` changes, which includes a language switch: the shell rebuilds the
 * context with the new `setup.locale`. Chat copy follows that locale.
 */
export default function ChatMount({ ctx }: FeatureProps) {
  const locale = ctx.locale;
  const strings = chatStrings(locale);
  const runtime = useMemo(() => {
    const natives: ChatNatives = {
      loadSdk: () => import('@unomed/react-native-matrix-sdk'),
      randomBytes: getRandomBytes,
      deleteAsync: (path, options) => deleteAsync(path, options),
      appVersion: APP_VERSION,
      pickImage,
    };
    const { host, engine } = createChatDeps(ctx, natives);
    return createChatRuntime(ctx, createChatHost(host), createNativeMatrixPort(engine), strings);
  }, [ctx, locale, strings]);
  return <ChatApp ctx={ctx} runtime={runtime} strings={strings} />;
}
