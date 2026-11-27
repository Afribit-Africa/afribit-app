import { Button, Card, Choice, Divider, ListRow, Screen, Stack, StatusPill, Text, space } from '@afribit/design';
import type { Locale } from '@afribit/feature-sdk';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Fragment, useEffect, useState } from 'react';
import { Alert, Clipboard, Linking, Platform, Switch } from 'react-native';
import { connectivityLabel, meshTrustLabel, pick, strings } from '../../i18n';
import { DIAGNOSTICS_BUILD } from '../../release-policy';
import { shortNpub } from '../../shell/identity';
import { useShell } from '../../shell/ShellProvider';
import { BLOG_URL, SUPPORT_EMAIL, supportMailto, supportReportBody } from '../../shell/supportCore';

export default function Profile() {
  const shell = useShell();
  const { setup } = shell;
  const npub = shell.npub;
  const t = strings[setup.locale];
  const [copied, setCopied] = useState(false);
  const paused = shell.crashes.quarantined.map((id) => shell.registry.get(id)).filter((f) => f !== undefined);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copyNpub = (value: string) => {
    Clipboard.setString(value);
    setCopied(true);
  };

  const reset = () => {
    Alert.alert(t.resetSetup, '', [
      { text: t.back, style: 'cancel' },
      { text: t.continue, style: 'destructive', onPress: () => void shell.resetSetup().then(() => router.replace('/onboarding')) },
    ]);
  };

  const reportProblem = () => {
    const body = supportReportBody({
      appVersion: Constants.expoConfig?.version ?? '',
      os: Platform.OS,
      osVersion: String(Platform.Version),
      locale: setup.locale,
      connectivity: connectivityLabel(shell.connectivity.state, setup.locale),
      meshTrust: meshTrustLabel(shell.connectivity.meshTrust, setup.locale),
    });
    Linking.openURL(supportMailto(t.reportProblem, body)).catch(() => Alert.alert(t.reportProblem, SUPPORT_EMAIL));
  };

  const emailAfribit = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => Alert.alert(t.emailAfribit, SUPPORT_EMAIL));
  };

  const openBlog = () => {
    void WebBrowser.openBrowserAsync(BLOG_URL);
  };

  return (
    <Screen edges={['top']}>
      <Text variant="screen">{t.profileTitle}</Text>
      <Card>
        <ListRow icon="person-outline" title={t.nickname} detail={setup.nickname} />
        <Divider />
        {npub ? (
          <>
            <ListRow
              icon="key-outline"
              title={t.identityKey}
              detail={shortNpub(npub)}
              trailing={<Button testID="profile-copy-npub" label={copied ? t.copied : t.copy} kind="quiet" icon="copy-outline" onPress={() => copyNpub(npub)} />}
            />
            <Divider />
          </>
        ) : shell.identityError ? (
          <>
            <ListRow
              testID="profile-identity-error"
              icon="key-outline"
              title={t.identityKey}
              detail={t.identityError}
              trailing={<StatusPill label={t.unavailable} tone="warning" />}
            />
            <Divider />
          </>
        ) : null}
        <ListRow icon="lock-closed-outline" title={t.protection} trailing={<StatusPill label={setup.protection ? t.on : t.off} tone={setup.protection ? 'positive' : 'warning'} />} />
      </Card>

      <Text variant="section">{t.language}</Text>
      <Stack gap={space.s}>
        {(['en', 'sw'] as Locale[]).map((l) => (
          <Choice key={l} testID={`profile-lang-${l}`} label={t.langNames[l]} selected={setup.locale === l} onPress={() => void shell.updateSetup({ locale: l })} />
        ))}
      </Stack>

      {paused.length > 0 ? (
        <>
          <Text variant="section">{t.pausedApps}</Text>
          <Card>
            {paused.map((f, i) => (
              <Fragment key={f.manifest.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={pick(f.manifest.displayName, setup.locale)}
                  trailing={<Button testID={`release-${f.manifest.id}`} label={t.tryAgain} kind="secondary" onPress={() => void shell.releaseApp(f.manifest.id)} />}
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {DIAGNOSTICS_BUILD ? (
        <Card>
          <ListRow
            title={t.simulateMesh}
            trailing={<Switch testID="simulate-mesh" value={shell.simulatedMesh} onValueChange={shell.setSimulatedMesh} />}
          />
        </Card>
      ) : null}

      <Text variant="section">{t.help}</Text>
      <Card>
        <ListRow testID="profile-report" icon="help-circle-outline" title={t.reportProblem} onPress={reportProblem} />
        <Divider />
        <ListRow testID="profile-email" icon="mail-outline" title={t.emailAfribit} onPress={emailAfribit} />
        <Divider />
        <ListRow testID="profile-blog" icon="globe-outline" title={t.afribitBlog} onPress={openBlog} />
        <Divider />
        <ListRow testID="profile-alerts" icon="notifications-outline" title={t.alertsTitle} onPress={() => router.push('/alerts')} />
      </Card>

      <Button testID="profile-reset" label={t.resetSetup} kind="quiet" onPress={reset} />
      <Text variant="supporting" tone="muted">
        Afribit OS {Constants.expoConfig?.version ?? ''}{DIAGNOSTICS_BUILD ? ' · diagnostics build' : ''}
      </Text>
    </Screen>
  );
}
