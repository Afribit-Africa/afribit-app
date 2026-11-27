# Security policy

Afribit handles people's money and private messages. We take reports seriously and credit reporters who want credit.

## Reporting a vulnerability

Email **connect@afribit.africa** with the subject line `SECURITY`. Include:
- what you found and where (file, screen or endpoint);
- steps to reproduce it;
- the impact you expect.

Please don't open a public issue for a vulnerability, and don't test against other people's wallets or accounts. We aim to acknowledge reports within 3 working days.

## Scope

- In scope: the app shell (`apps/shell`, `packages/*`), the Wallet (`modules/wallet`), Chat (`features/chat`) and the chat gateway (`services/chat-gate`).
- Out of scope: third-party services the app talks to, such as Lightning providers and the Matrix homeserver software. Report those to their maintainers.

## Status

This is a **preview**. It has not had an independent security audit yet; one is planned before a general release. Test with small amounts only.
