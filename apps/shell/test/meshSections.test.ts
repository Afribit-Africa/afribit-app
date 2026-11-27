import { describe, expect, it } from 'vitest';
import { meshSectionRoute } from '../src/shell/meshSections';

describe('meshSectionRoute', () => {
  it('opens My passes when the feature asks for packages', () => {
    expect(meshSectionRoute('packages')).toEqual({ pathname: '/connect/passes' });
  });

  it('opens the top of Connect when the feature asks for settings', () => {
    expect(meshSectionRoute('settings')).toEqual({ pathname: '/connect' });
  });

  it('opens the top of Connect when the feature asks for identity', () => {
    expect(meshSectionRoute('identity')).toEqual({ pathname: '/connect' });
  });

  it('opens the top of Connect when the intent names no section', () => {
    expect(meshSectionRoute(undefined)).toEqual({ pathname: '/connect' });
  });
});
