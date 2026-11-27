import type { FeatureProps } from '@afribit/feature-sdk';
import type { ComponentType } from 'react';

/**
 * Static map from feature id to its entry component. Loaded lazily so a feature's
 * module code only evaluates when the user opens it. No remote URLs, no computed
 * module paths (PRD §8.3).
 */
type Loader = () => ComponentType<FeatureProps>;

export const FEATURE_ENTRIES: Readonly<Record<string, Loader>> = {
  wallet: () => require('./wallet/WalletMount').default,
  chat: () => require('./chat/ChatMount').default,
  ai: () => require('@afribit/feature-ai').default,
  diagnostics: () => require('@afribit/feature-diagnostics').default,
};
