import { Button, Card, Divider, Icon, ListRow, Screen, Text, space, touchTarget } from '@afribit/design';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { strings } from '../i18n';
import type { AlertEntry } from '../shell/alertLogCore';
import { openFeature } from '../shell/openFeature';
import { useShell } from '../shell/ShellProvider';

/** Notifications the shell has shown, so one missed or dismissed can be read again (PRD P02). */
export default function Alerts() {
  const shell = useShell();
  const { setup, alerts } = shell;
  const t = strings[setup.locale];
  const locale = setup.locale === 'sw' ? 'sw-KE' : 'en-KE';

  const stamp = (at: number) => {
    const date = new Date(at);
    return `${date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  };

  const open = (entry: AlertEntry) => {
    const target = entry.target;
    if (target?.open !== 'app') return;
    if (!shell.registry.get(target.id)) return;
    openFeature(shell, target.id);
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t.back} onPress={() => router.back()} style={styles.back} hitSlop={8}>
        <Icon name="chevron-back" size={20} />
        <Text variant="button">{t.back}</Text>
      </Pressable>
      <Text variant="screen">{t.alertsTitle}</Text>

      {alerts.length === 0 ? (
        <Card>
          <Text variant="supporting" tone="muted">{t.alertsEmpty}</Text>
        </Card>
      ) : (
        <>
          <Card>
            {alerts.map((entry, i) => (
              <Fragment key={entry.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  testID={`alert-${entry.id}`}
                  icon={entry.target?.open === 'passes' ? 'ticket-outline' : 'notifications-outline'}
                  title={entry.title}
                  detail={`${entry.sender} · ${stamp(entry.at)}`}
                  onPress={entry.target?.open === 'app' && shell.registry.get(entry.target.id) ? () => open(entry) : undefined}
                />
              </Fragment>
            ))}
          </Card>
          <Button testID="alerts-clear" label={t.alertsClear} kind="quiet" onPress={() => void shell.clearAlerts()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touchTarget, alignSelf: 'flex-start' },
});
