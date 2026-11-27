/**
 * The one host Chat may get a NIP-98 signature for (CR-3). Exact origin only:
 * a lookalike host, another port or an http URL is refused by the kernel check,
 * so a feature can never turn this into a signature for a different service.
 */
export const CHAT_GATE_ORIGINS: readonly string[] = ['https://chat-gate.mesh.afribit.africa'];
