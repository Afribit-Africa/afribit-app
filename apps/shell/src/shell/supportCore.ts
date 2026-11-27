import type { Locale } from '@afribit/feature-sdk';
import { strings } from '../i18n';

export const SUPPORT_EMAIL = 'connect@afribit.africa';
export const BLOG_URL = 'https://afribit.africa/blog';

/**
 * Only non-identifying build and connection facts. The redaction is the type: there is no
 * field for a nickname, npub, pass or wallet data, so a report cannot carry one.
 */
export interface SupportReportInfo {
  readonly appVersion: string;
  readonly os: string;
  readonly osVersion: string;
  readonly locale: Locale;
  readonly connectivity: string;
  readonly meshTrust: string;
}

export function supportReportBody(info: SupportReportInfo): string {
  const lines = [
    `App version: ${info.appVersion}`,
    `OS: ${info.os}`,
    `OS version: ${info.osVersion}`,
    `Language: ${info.locale}`,
    `Connectivity: ${info.connectivity}`,
    `Mesh trust: ${info.meshTrust}`,
  ];
  return `${lines.join('\n')}\n\n${strings[info.locale].describeWhatHappened}`;
}

export function supportMailto(subject: string, body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}