import type { CapabilityOutcome, ConnectivitySnapshot, FeatureContext } from '@afribit/feature-sdk';

/** A wallet.preparePayment outcome. A payment never inherits a profile, so 'profile' is excluded. */
export type PaymentOutcome = Exclude<CapabilityOutcome, { status: 'profile' }>;

export type MessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type Verification = 'verified' | 'unverified' | 'changed';
export interface ChatMessage {
  id: string; transactionId?: string; roomId: string; senderId: string; text: string;
  timestamp: number; own: boolean; status: MessageStatus; senderName?: string;
  paymentRequest?: string;
}
export interface ChatRoom {
  id: string; name: string; initials: string; kind: 'direct' | 'group'; unread: number;
  verification: Verification; encrypted: boolean; members: number; peerUserId?: string; messages: readonly ChatMessage[];
}
export interface ChatProfile { npub: string; nickname: string }
export interface Session { homeserver: string; userId: string; deviceId: string; accessToken: string }
export interface ChatSnapshot {
  phase: 'locked' | 'connecting' | 'ready' | 'error' | 'signed-out';
  rooms: readonly ChatRoom[]; profile?: ChatProfile; error?: string; preview: boolean;
  directoryOptIn: boolean;
  connectivity: ConnectivitySnapshot;
}
export interface VerificationChallenge { id: string; emoji: readonly { symbol: string; label: string }[] }

/** Host-owned integration. The feature never receives an identity secret. See CRs. */
export interface ChatHost {
  readonly dataDir: string;
  readonly gateOrigin: string;
  readonly matrixOrigin: string;
  readonly matrixServerName: string;
  profile(): Promise<ChatProfile>;
  authorize(request: { method: 'POST'; url: string; bodySha256: string }): Promise<string>;
  sha256(body: string): Promise<string>;
  vault: { get(name: string): Promise<string | null>; put(name: string, secret: string): Promise<void> };
  notify(request: { title: string; body: string }): Promise<void>;
  screenSecurity(enabled: boolean): Promise<void>;
  onIdentityEnding(listener: () => Promise<void>): () => void;
  /** Host drains this encrypted revocation request after wipe, including off-mesh sign-out. */
  deferDeviceRevocation(session: Session): Promise<void>;
  requestPayment(request: string): Promise<PaymentOutcome>;
  /** Shell-owned camera: resolves with the scanned string, or null when the user cancels. */
  scanQr(): Promise<string | null>;
  /** Shell-owned display: shows the payload as a QR with a caption. */
  showQr(payload: string, caption: string): Promise<void>;
}

/** An adapter for the reviewed native Matrix SDK, never a replacement crypto implementation. */
export interface MatrixPort {
  randomId(): string;
  open(options: { dataDir: string; owner: string; session: Session }): Promise<void>;
  security(): Promise<{ encryptedStore: boolean; e2ee: boolean }>;
  preferences(): Promise<{ directoryOptIn: boolean }>;
  recovery(): Promise<{ exists: boolean }>;
  newRecoveryKey(): Promise<string>;
  enableRecovery(key: string): Promise<void>;
  /** Set the inherited nickname only for an account with no existing Chat display name. */
  setInitialDisplayName(nickname: string): Promise<void>;
  subscribe(listener: (rooms: readonly ChatRoom[]) => void): () => void;
  sync(): Promise<void>;
  seal(value: string, associatedData: string): Promise<string>;
  unseal(value: string, associatedData: string): Promise<string>;
  sendEncrypted(roomId: string, text: string, transactionId: string): Promise<{ eventId: string }>;
  createEncryptedRoom(name: string, users: readonly string[], group: boolean): Promise<string>;
  invite(roomId: string, userId: string): Promise<void>;
  leave(roomId: string): Promise<void>;
  markRead(roomId: string, eventId: string): Promise<void>;
  block(userId: string): Promise<void>;
  beginVerification(userId: string): Promise<VerificationChallenge>;
  confirmVerification(id: string, matches: boolean): Promise<void>;
  /** Returns only after actual SDK cross-signing, never after parsing a contact QR. */
  verifyContactQr(payload: string): Promise<{ userId: string; verified: boolean }>;
  ownContactQr(): Promise<string>;
  setDirectoryOptIn(enabled: boolean): Promise<void>;
  sendEncryptedImage(roomId: string, options: { maxDimension: number; maxBytes: number; allowedTypes: readonly string[] }): Promise<void>;
  stop(): Promise<void>;
  wipe(): Promise<void>;
}
export interface ChatRuntime {
  snapshot(): ChatSnapshot;
  subscribe(listener: (state: ChatSnapshot) => void): () => void;
  start(): Promise<void>;
  dispose(): Promise<void>;
  retry(): Promise<void>;
  updateConnectivity(connectivity: ConnectivitySnapshot): void;
  send(roomId: string, text: string): Promise<void>;
  createRoom(name: string, users: readonly string[], group: boolean): Promise<string>;
  invite(roomId: string, userId: string): Promise<void>;
  leave(roomId: string): Promise<void>;
  markRead(roomId: string): Promise<void>;
  addContact(payload: string): Promise<{ userId: string; verified: boolean }>;
  ownQr(): Promise<string>;
  scanQr(): Promise<string | null>;
  showOwnQr(): Promise<void>;
  beginVerification(userId: string): Promise<VerificationChallenge>;
  confirmVerification(id: string, matches: boolean): Promise<void>;
  setDirectory(enabled: boolean): Promise<void>;
  protectScreen(enabled: boolean): Promise<void>;
  sendImage(roomId: string): Promise<void>;
  pay(request: string): Promise<PaymentOutcome>;
  block(userId: string): Promise<void>;
}
export type ChatFeatureProps = { ctx: FeatureContext; runtime?: ChatRuntime };
