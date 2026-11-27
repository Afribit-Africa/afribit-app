# Afribit Chat gate (Node 24)

The gate authenticates the shell identity and current mesh independently, maps it to an opaque Matrix localpart using a durable server-side HMAC pepper, exchanges a short-lived JWT with loopback Tuwunel, and returns a Matrix device session. The JWT never reaches the feature. No Nostr relays are contacted. Public/remote access is out of scope.

Run `npm ci --ignore-scripts`, `npm test`, `npm run typecheck`. Service has independent locked dependencies; it does not change the mobile app dependency graph. No install lifecycle scripts run.

## Environment (paths, never secret values in command lines)

`CHAT_GATE_ORIGIN`: exact mesh-only HTTPS origin. `CHAT_MATRIX_PUBLIC_URL`: exact approved HTTPS Matrix origin. `CHAT_MATRIX_INTERNAL_URL`: loopback origin (e.g. `http://127.0.0.1:8788`). `CHAT_MATRIX_SERVER_NAME`: immutable Matrix server name. `CHAT_GATE_PORT`: defaults 8789, loopback only. `CHAT_JWT_SECRET_FILE`, `CHAT_IDENTITY_PEPPER_FILE`, `CHAT_MATRIX_ADMIN_TOKEN_FILE`: mode-0600 files. `CHAT_STATE_FILE`: durable SQLite in a mode-0700 directory. `CHAT_ALLOWED_MESHES`: comma-separated IDs. `CHAT_MESH_KEYS_FILE`: JSON object keyed by enrolled key ID; each value is `{meshId,nodeId,publicKeyPem}` using pinned Ed25519 SPKI PEM public keys.

Tuwunel must accept HS256 JWT with issuer equal to gate origin, audience equal to server name, exp/nbf required and validated. Disable passwords/open registration/federation/first-user admin. Provision the admin credential only through the reviewed operator bootstrap; Chat users never receive it. `server.ts` rejects missing secrets, short keys, malformed origins and non-loopback Matrix targets. Never expose the administrative API through the client proxy.

## Requests

`POST /v1/session` body `{}` returns `{homeserver,userId,deviceId,accessToken}`. `POST /v1/device/revoke` body `{deviceId}` revokes only a device previously issued to that identity. Both require JSON, NIP-98 `Authorization: Nostr <base64 event>` with exact `u`, `method`, `payload` SHA256 tags and independently Ed25519-signed proof in `afribit.mesh`. The exact proof wire format is being specified with the mesh service. Do not copy those internal docs into an external service.

Proofs bind version, mesh/node/key, feature=chat, identity pubkey, random nonce and <=60-second validity. Nostr events are <=60 seconds old, with <=5-second future skew. Replay records and per-identity/per-node limits are transactional and persist across restart. Bans use the same identity HMAC. A failed provisioning request consumes its proof; the shell must produce a fresh authorization for retry. Sessions use server-generated device IDs to prevent overwriting another device. Revocation removes the Tuwunel device and its access token; it does not delete message history.

Logs contain random request IDs, status/code and optionally identity HMAC, never headers, tokens, raw npubs, room names or messages. No SDK debug logger is installed in the gate. All responses use no-store. Add a reviewed ingress rate limit before exposing the signature-verification route to a community LAN; the gate's authenticated limits do not replace connection/unauthenticated CPU limits.

The identity HMAC pepper is durable identity mapping data. Back it up encrypted and do not rotate it without an account-mapping migration. Admin device revocation and server policy enforcement require operator review before deployment. The server still observes membership, event timing and ciphertext sizes; E2EE does not make metadata anonymous.
