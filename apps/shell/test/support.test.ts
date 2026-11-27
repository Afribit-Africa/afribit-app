import { describe, expect, it } from 'vitest';
import { BLOG_URL, SUPPORT_EMAIL, supportMailto, supportReportBody } from '../src/shell/supportCore';

const report = {
  appVersion: '1.4.2',
  os: 'android',
  osVersion: '15',
  locale: 'en' as const,
  connectivity: 'Internet available',
  meshTrust: 'Not on the Afribit Mesh',
};

describe('support report body', () => {
  it('contains exactly the build and connection fields, then the prompt', () => {
    expect(supportReportBody(report)).toBe(
      [
        'App version: 1.4.2',
        'OS: android',
        'OS version: 15',
        'Language: en',
        'Connectivity: Internet available',
        'Mesh trust: Not on the Afribit Mesh',
        '',
        'Describe what happened:',
      ].join('\n'),
    );
  });

  it('localises the prompt for Kiswahili', () => {
    expect(supportReportBody({ ...report, locale: 'sw', connectivity: 'Intaneti ipo', meshTrust: 'Hauko kwenye Afribit Mesh' })).toBe(
      [
        'App version: 1.4.2',
        'OS: android',
        'OS version: 15',
        'Language: sw',
        'Connectivity: Intaneti ipo',
        'Mesh trust: Hauko kwenye Afribit Mesh',
        '',
        'Eleza kilichotokea:',
      ].join('\n'),
    );
  });

  it('has no field for a nickname, key, pass or wallet value', () => {
    const body = supportReportBody(report);
    expect(body).not.toContain('npub');
    expect(body).not.toContain('Nickname');
    expect(body).not.toContain('Wallet');
  });
});

describe('support mailto', () => {
  it('addresses the support inbox and encodes separators, newlines and spaces', () => {
    const url = supportMailto('A & B?', 'line one\nline two & more?');
    expect(url).toBe(`mailto:${SUPPORT_EMAIL}?subject=A%20%26%20B%3F&body=line%20one%0Aline%20two%20%26%20more%3F`);
  });

  it('round-trips subject and body through decodeURIComponent', () => {
    const subject = 'A & B?';
    const body = 'line one\nline two & more? some/path #tag';
    const url = supportMailto(subject, body);
    const query = url.slice(url.indexOf('?') + 1);
    const separator = '&body=';
    const bodyStart = query.indexOf(separator);
    expect(bodyStart).toBeGreaterThan(-1);
    const subjectPart = query.slice('subject='.length, bodyStart);
    const bodyPart = query.slice(bodyStart + separator.length);
    expect(decodeURIComponent(subjectPart)).toBe(subject);
    expect(decodeURIComponent(bodyPart)).toBe(body);
  });

  it('points the blog link at the Afribit blog', () => {
    expect(BLOG_URL).toBe('https://afribit.africa/blog');
  });
});