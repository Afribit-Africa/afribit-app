import type { Locale } from '@afribit/feature-sdk';
import type { AvailabilityResult, RegisteredFeature } from '@afribit/kernel';

export interface AppFilter {
  /** Free text from the search field. Empty or whitespace matches every app. */
  readonly query: string;
  /** Keep only apps that can run on the current network (PRD H02). */
  readonly worksNow: boolean;
}

/** Comparison form: lower case with combining accents stripped, so "Café" matches "cafe". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function matchesText(feature: RegisteredFeature, needle: string, locale: Locale): boolean {
  const { displayName, tagline } = feature.manifest;
  return [displayName[locale], displayName.en, tagline[locale], tagline.en]
    .some((text) => fold(text).includes(needle));
}

/**
 * The Apps directory search and "Works now" filter (PRD H02). Pure, so the tab and its
 * tests share one implementation: it takes the availability lookup instead of reading the
 * shell. Matching ignores case and accents across the display name and tagline in the
 * current locale and in English; registry order is kept.
 */
export function filterApps(
  features: readonly RegisteredFeature[],
  { query, worksNow }: AppFilter,
  locale: Locale,
  availabilityOf: (id: string) => AvailabilityResult,
): readonly RegisteredFeature[] {
  const needle = fold(query.trim());
  return features.filter((feature) => {
    if (needle.length > 0 && !matchesText(feature, needle, locale)) return false;
    if (worksNow && availabilityOf(feature.manifest.id).status === 'unavailable') return false;
    return true;
  });
}
