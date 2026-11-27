# Contributing

Thank you for helping. Issues and pull requests are welcome.

## Before you start

- Read `docs/PRD.md`, the product requirements and architecture. It sets the rules every change must follow, such as: modules never share keys, only the Wallet can move money, and no balances appear on Home.
- For anything larger than a small fix, open an issue first so we can agree on the approach.

## Making a change

1. Use Node 24 and npm, then run `npm ci` at the repository root.
2. Keep changes small and focused, with tests. The checks run with `npm run check` (typecheck and unit tests). The Wallet has its own suite: `npm run check:wallet`.
3. Write user-facing text in both English and Kiswahili (`apps/shell/src/i18n.ts`, `features/chat/src/strings.ts`).
4. Take colours, spacing and type only from `packages/design` tokens.
5. Never commit secrets. Build-time keys come from environment variables (see `docs/BUILDING.md`).

By contributing, you agree that your contribution is licensed under the MIT License.
