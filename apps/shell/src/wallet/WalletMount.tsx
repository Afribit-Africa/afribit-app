import type { FeatureProps } from '@afribit/feature-sdk';
import WalletRoot from '@afribit/wallet-app';
import { walletHandoff } from './handoff';

/**
 * Mounts the built-in Wallet (S-17, ONE_APP_PLAN W1). It is first-party class A code in the
 * shell's process for now; W2 moves it to its own Android process. The Wallet keeps its own
 * storage, PIN and keys, and money moves only through its own confirmation screens (S-12),
 * so the shell gives it nothing beyond the screen and the pending hand-off.
 */
export default function WalletMount(_props: FeatureProps) {
  return <WalletRoot handoff={walletHandoff} />;
}
