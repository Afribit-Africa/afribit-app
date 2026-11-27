# Afribit Chat

Native messenger UI combining the approved first inbox and third conversation concepts. The default entry accepts the current FeatureContext and shows a locked integration state until the reviewed host and native Matrix adapter are supplied. It does not ship a fake messenger or demo credentials.

`src/core/types.ts` defines host/native ports; `src/core/runtime.ts` handles identity-bound sessions, vault-backed recovery, encrypted-only rooms, changed-device blocking, private notifications, payments and lifecycle cleanup. `src/core/outbox.ts` persists only native-sealed ciphertext in scoped secure storage with stable Matrix transaction IDs. The actual native adapter must provide authenticated at-rest encryption; the feature never invents a cryptographic protocol.

All policy values are marked provisional in `src/core/policy.ts`; reconcile owner policies before each milestone. English copy is centralized. No direct Nostr relay access, Wallet key access, calls, voice notes, videos/files, federation or off-mesh access are included.

Run from the repository root:

```sh
npm run check
npx tsc -p features/chat --noEmit
npx vitest run --config features/chat/vitest.config.mts
npm --prefix services/chat-gate run typecheck
npm --prefix services/chat-gate test
```

The root test config runs the Chat suite through `test.projects`, so `npm run check` covers it; the separate command above is only for iterating on Chat alone. `preview/` is an explicit, memory-only visual-review harness and is never imported by the production feature entry. It never sends messages; compose produces a queued sample message and every screen is marked as a preview.

Keep manifest readiness preview and no network domains until exact mesh HTTPS hosts, native SDK, host capabilities and production isolation are reviewed.
