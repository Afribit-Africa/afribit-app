import { describe, expect, it } from 'vitest';
import { allowedBeforeOnboarding, createPendingRoute, keepLinkRoute, pendingRouteFor, shellRouteForLink } from '../src/shell/pendingRouteCore';

describe('allowedBeforeOnboarding', () => {
  it('allows onboarding itself', () => {
    expect(allowedBeforeOnboarding(['onboarding'])).toBe(true);
  });

  it('allows an onboarding step', () => {
    expect(allowedBeforeOnboarding(['onboarding', 'protect'])).toBe(true);
  });

  it('refuses the tabs', () => {
    expect(allowedBeforeOnboarding(['(tabs)'])).toBe(false);
  });

  it('refuses an app', () => {
    expect(allowedBeforeOnboarding(['app', '[id]'])).toBe(false);
  });

  it('refuses a join link', () => {
    expect(allowedBeforeOnboarding(['connect', 'join'])).toBe(false);
  });

  it('refuses the empty route', () => {
    expect(allowedBeforeOnboarding([])).toBe(false);
  });
});

describe('pendingRouteFor', () => {
  it('drops a param that is already a path segment', () => {
    expect(pendingRouteFor('/app/chat', { id: 'chat' })).toBe('/app/chat');
  });

  it('keeps query params as a query string', () => {
    expect(pendingRouteFor('/connect/join', { ticket: 't', session: 's' })).toBe('/connect/join?ticket=t&session=s');
  });

  it('URI-encodes query values', () => {
    expect(pendingRouteFor('/connect/join', { ticket: 'a b/c' })).toBe('/connect/join?ticket=a%20b%2Fc');
  });

  it('refuses the home path', () => {
    expect(pendingRouteFor('/', {})).toBeNull();
  });

  it('refuses an onboarding path', () => {
    expect(pendingRouteFor('/onboarding/protect', {})).toBeNull();
  });

  it('refuses a path that does not start with a slash', () => {
    expect(pendingRouteFor('x', {})).toBeNull();
  });

  it('refuses a path over 2048 characters', () => {
    expect(pendingRouteFor(`/${'a'.repeat(2999)}`, {})).toBeNull();
  });
});

describe('createPendingRoute', () => {
  it('takes the route it was given, once', () => {
    const slot = createPendingRoute();
    slot.put('/app/chat');
    expect(slot.take()).toBe('/app/chat');
    expect(slot.take()).toBeNull();
  });

  it('replaces the older route with a newer one', () => {
    const slot = createPendingRoute();
    slot.put('/app/chat');
    slot.put('/connect/join');
    expect(slot.take()).toBe('/connect/join');
  });

  it('takes null when nothing was put', () => {
    expect(createPendingRoute().take()).toBeNull();
  });
});

describe('shellRouteForLink', () => {
  it('reads a shell link', () => {
    expect(shellRouteForLink('afribit://connect/passes')).toBe('/connect/passes');
  });

  it('reads a bare path', () => {
    expect(shellRouteForLink('/app/wallet')).toBe('/app/wallet');
  });

  it('keeps a plain query', () => {
    expect(shellRouteForLink('afribit://connect/join?ticket=Ab-1_x%2B&session=s1')).toBe('/connect/join?ticket=Ab-1_x%2B&session=s1');
  });

  it('ignores the scheme case and repeated slashes', () => {
    expect(shellRouteForLink('AFRIBIT://connect//passes/')).toBe('/connect/passes');
  });

  it('refuses Home, onboarding and other schemes', () => {
    expect(shellRouteForLink('afribit://')).toBeNull();
    expect(shellRouteForLink('/')).toBeNull();
    expect(shellRouteForLink('afribit://onboarding/done')).toBeNull();
    expect(shellRouteForLink('https://afribit.africa/connect/passes')).toBeNull();
    expect(shellRouteForLink('lightning:lnbc1')).toBeNull();
    expect(shellRouteForLink('//evil.example/x')).toBeNull();
  });

  it('refuses dot segments, odd characters and over-long routes', () => {
    expect(shellRouteForLink('afribit://connect/../onboarding')).toBeNull();
    expect(shellRouteForLink('afribit://connect/pa sses')).toBeNull();
    expect(shellRouteForLink('afribit://connect/passes?x=<script>')).toBeNull();
    expect(shellRouteForLink('afribit://connect/passes?x=a%zz')).toBeNull();
    expect(shellRouteForLink(`afribit://connect/join?t=${'a'.repeat(2100)}`)).toBeNull();
  });
});

describe('keepLinkRoute', () => {
  it('keeps a route while setup is not complete', () => {
    const slot = createPendingRoute();
    keepLinkRoute(slot, '/connect/passes', false);
    expect(slot.take()).toBe('/connect/passes');
  });

  it('keeps a route before setup has been read', () => {
    const slot = createPendingRoute();
    keepLinkRoute(slot, '/connect/passes', null);
    expect(slot.take()).toBe('/connect/passes');
  });

  it('keeps nothing once setup is complete', () => {
    const slot = createPendingRoute();
    keepLinkRoute(slot, '/connect/passes', true);
    expect(slot.take()).toBeNull();
  });

  it('leaves an earlier route when the link has none', () => {
    const slot = createPendingRoute();
    slot.put('/alerts');
    keepLinkRoute(slot, null, false);
    expect(slot.take()).toBe('/alerts');
  });
});
