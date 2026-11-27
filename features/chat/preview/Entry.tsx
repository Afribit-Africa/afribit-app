import { useMemo } from 'react';
import type { FeatureProps } from '@afribit/feature-sdk';
import { ChatApp } from '../src/ui/ChatApp';
import { createPreviewRuntime } from './runtime';
export default function ChatReview({ ctx }: FeatureProps) {
  const runtime = useMemo(createPreviewRuntime, []);
  return <ChatApp ctx={ctx} runtime={runtime} />;
}
