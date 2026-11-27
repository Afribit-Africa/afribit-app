import { randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { GateError } from './auth.ts';

export interface MatrixSession { homeserver: string; userId: string; deviceId: string; accessToken: string }
export interface MatrixProvider {
  login(localpart: string): Promise<MatrixSession>;
  revoke(session: { userId: string; deviceId: string }): Promise<void>;
}
export interface MatrixConfig { internalUrl: string; publicUrl: string; serverName: string; jwtSecret: string; jwtIssuer: string; adminToken: string }

/** JWTs never leave this process. Tuwunel consumes them over a loopback-only connection. */
export class TuwunelProvider implements MatrixProvider {
  private readonly config: MatrixConfig;
  constructor(config: MatrixConfig) { this.config = config; }
  async login(localpart: string): Promise<MatrixSession> {
    const c = this.config;
    const jwt = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(localpart).setIssuer(c.jwtIssuer)
      .setAudience(c.serverName).setIssuedAt().setNotBefore('0s').setExpirationTime('30s').setJti(randomBytes(24).toString('base64url'))
      .sign(Buffer.from(c.jwtSecret));
    const deviceId = 'AFRIBIT_' + randomBytes(18).toString('hex');
    const response = await fetch(c.internalUrl + '/_matrix/client/v3/login', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'org.matrix.login.jwt', token: jwt, device_id: deviceId, initial_device_display_name: 'Afribit Chat' }),
    });
    if (!response.ok) throw new GateError(503, 'chat_service_unavailable');
    const body = await response.json() as Record<string, unknown>;
    const userId = '@' + localpart + ':' + c.serverName;
    if (body.user_id !== userId || body.device_id !== deviceId || typeof body.access_token !== 'string') throw new GateError(503, 'invalid_homeserver_response');
    return { homeserver: c.publicUrl, userId, deviceId, accessToken: body.access_token };
  }
  async revoke(session: { userId: string; deviceId: string }): Promise<void> {
    if (!this.config.adminToken) throw new GateError(503, 'device_revocation_unavailable');
    const path = '/_synapse/admin/v2/users/' + encodeURIComponent(session.userId) + '/devices/' + encodeURIComponent(session.deviceId);
    const response = await fetch(this.config.internalUrl + path, { method: 'DELETE', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + this.config.adminToken } });
    if (!response.ok && response.status !== 404) throw new GateError(503, 'device_revocation_unavailable');
  }
}
