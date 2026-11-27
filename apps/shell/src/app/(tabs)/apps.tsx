import { Card, Divider, Icon, ListRow, Screen, StatusPill, Text, color, radius, space, touchTarget, type IconName, type as typo } from '@afribit/design';
import type { Category } from '@afribit/kernel';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { availabilityLabel, networkNeedLabel, pick, strings } from '../../i18n';
import { FEATURE_LOOK } from '../../release-policy';
import { filterApps } from '../../shell/appSearchCore';
import { useShell } from '../../shell/ShellProvider';

const CATEGORY: Record<Category, { en: string; sw: string }> = {
  money: { en: 'Money', sw: 'Pesa' },
  communication: { en: 'Community & communication', sw: 'Jamii na mawasiliano' },
  network: { en: 'Local network', sw: 'Mtandao wa karibu' },
  learning: { en: 'Learning', sw: 'Kujifunza' },
  work: { en: 'Work & earning', sw: 'Kazi na mapato' },
  tools: { en: 'Tools', sw: 'Zana' },
};

/** Full directory with search and a "Works now" filter. Every app shows its real readiness; nothing is faked (PRD H02). */
export default function Apps() {
  const shell = useShell();
  const t = strings[shell.setup.locale];
  const [query, setQuery] = useState('');
  const [worksNow, setWorksNow] = useState(false);
  const features = shell.registry.features.filter((f) => f.enabled);
  const matching = filterApps(features, { query, worksNow }, shell.setup.locale, shell.availabilityOf);
  const groups = (Object.keys(CATEGORY) as Category[])
    .map((c) => ({ c, items: matching.filter((f) => f.manifest.category === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <Screen edges={['top']}>
      <Text variant="screen">{t.appsTitle}</Text>
      <Text variant="body" tone="muted">{t.appsBody}</Text>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <TextInput
            testID="apps-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t.appsSearchPlaceholder}
            placeholderTextColor={color.inputBoundary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            returnKeyType="search"
            accessibilityLabel={t.appsSearchPlaceholder}
            style={styles.input}
          />
          {query.length > 0 ? (
            <Pressable
              testID="apps-search-clear"
              accessibilityRole="button"
              accessibilityLabel={t.appsClearSearch}
              onPress={() => setQuery('')}
              style={styles.clear}
            >
              <Icon name="close-circle" size={22} tint={color.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          testID="apps-works-now"
          accessibilityRole="switch"
          accessibilityState={{ checked: worksNow }}
          accessibilityLabel={t.appsWorksNow}
          onPress={() => setWorksNow((on) => !on)}
          style={[styles.chip, worksNow && styles.chipOn]}
        >
          <Text variant="label" tone={worksNow ? 'forest' : 'muted'}>{t.appsWorksNow}</Text>
        </Pressable>
      </View>
      {groups.length === 0 && features.length > 0 ? <Text variant="body" tone="muted">{t.appsNoMatch}</Text> : null}
      {groups.map(({ c, items }) => (
        <Fragment key={c}>
          <Text variant="section">{CATEGORY[c][shell.setup.locale]}</Text>
          <Card>
            {items.map((f, i) => {
              const id = f.manifest.id;
              const status = availabilityLabel(shell.availabilityOf(id), shell.setup.locale);
              const need = networkNeedLabel(f.manifest.requires.network, shell.setup.locale);
              const tagline = pick(f.manifest.tagline, shell.setup.locale);
              return (
                <Fragment key={id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    testID={`apps-${id}`}
                    icon={(FEATURE_LOOK[id]?.icon ?? 'apps') as IconName}
                    title={pick(f.manifest.displayName, shell.setup.locale)}
                    detail={tagline ? `${tagline} · ${need}` : need}
                    trailing={status ? <StatusPill label={status.label} tone={status.tone} /> : undefined}
                    onPress={() => router.push({ pathname: '/service/[id]', params: { id } })}
                  />
                </Fragment>
              );
            })}
          </Card>
        </Fragment>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  searchField: { flex: 1, justifyContent: 'center' },
  input: { ...typo.body, minHeight: touchTarget, borderWidth: 1, borderColor: color.inputBoundary, borderRadius: radius.control, paddingHorizontal: space.l, paddingRight: touchTarget, backgroundColor: color.white, color: color.ink },
  clear: { position: 'absolute', right: 0, width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: space.l, borderRadius: radius.pill, borderWidth: 1, borderColor: color.divider, backgroundColor: color.paper },
  chipOn: { borderColor: color.forest, backgroundColor: color.forestTint },
});
