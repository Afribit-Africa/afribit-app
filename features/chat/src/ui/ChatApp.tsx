import { Button, Icon, Screen, Text, color, space, touchTarget, type IconName } from '@afribit/design';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Switch, TextInput, useWindowDimensions, View } from 'react-native';
import { CHAT_POLICY } from '../core/policy';
import { unavailableSnapshot } from '../core/runtime';
import { canReachMesh, ChatError, paymentRequest } from '../core/security';
import type { ChatFeatureProps, ChatMessage, ChatRoom, VerificationChallenge } from '../core/types';
import { copy as english } from '../strings';
import { styles as s } from './styles';

type Sheet = 'new' | 'contact' | 'settings' | 'details' | 'verify' | null;
function Action({ icon, label, onPress, disabled = false }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} style={[s.iconButton, disabled && s.disabled]}><Icon name={icon} /></Pressable>;
}
function Avatar({ room }: { room: ChatRoom }) {
  return <View style={s.avatar} importantForAccessibility="no-hide-descendants">{room.kind === 'group' ? <Icon name="people-outline" tint={color.forest} /> : <Text variant="section" tone="forest">{room.initials}</Text>}</View>;
}
function time(stamp: number) { return new Date(stamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function lastTime(room: ChatRoom) {
  const stamp = room.messages.at(-1)?.timestamp;
  if (!stamp) return '';
  return new Date(stamp).toDateString() === new Date().toDateString() ? time(stamp) : new Date(stamp).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function ChatApp({ ctx, runtime, strings = english }: ChatFeatureProps & { strings?: typeof english }) {
  const copy = strings;
  const [storedState, setState] = useState(() => runtime?.snapshot() ?? unavailableSnapshot(ctx));
  const state = runtime ? storedState : unavailableSnapshot(ctx);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [search, setSearch] = useState(''); const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState(''); const [users, setUsers] = useState('');
  const [group, setGroup] = useState(false); const [contact, setContact] = useState('');
  const [protection, setProtection] = useState(false);
  const [typing, setTyping] = useState(false);
  const viewport = useWindowDimensions();
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const performing = useRef(false);
  const select = (id: string | null) => { setDraft(''); setSelected(id); setNotice(null); };
  const active = state.rooms.find(r => r.id === selected);
  const ready = !!runtime && state.phase === 'ready';
  const network = canReachMesh(state.connectivity);
  useEffect(() => {
    setState(runtime?.snapshot() ?? unavailableSnapshot(ctx));
    if (!runtime) return;
    const remove = runtime.subscribe(setState);
    void runtime.start();
    return () => { remove(); void runtime.dispose(); };
  }, [runtime]);
  useEffect(() => { if (runtime) runtime.updateConnectivity(ctx.connectivity); else setState(unavailableSnapshot(ctx)); }, [ctx.connectivity, runtime]);
  useEffect(() => {
    if (state.phase === 'signed-out') { setDraft(''); select(null); setSheet(null); setContact(''); setUsers(''); setName(''); setChallenge(null); }
  }, [state.phase]);
  useEffect(() => { setDraft(''); setNotice(null); }, [selected]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => { if (selected && ready && network) void runtime?.markRead(selected).catch(() => undefined); }, [selected, ready, network, runtime]);
  async function perform(operation: () => Promise<void>) {
    if (performing.current) return;
    performing.current = true;
    setBusy(true); setNotice(null);
    try { await operation(); }
    catch (error) { setNotice(copy.errors[error instanceof ChatError ? error.code : 'connection-failed'] ?? copy.errors['connection-failed']!); }
    finally { performing.current = false; setBusy(false); }
  }
  const retry = () => void perform(async () => { await runtime?.retry(); });
  const show = (next: Sheet) => { setNotice(null); setSheet(next); };
  const close = () => {
    if (challenge) { void runtime?.confirmVerification(challenge.id, false).catch(() => undefined); setChallenge(null); }
    setSheet(null);
  };
  const error = notice ?? (state.error && state.error !== 'host-integration-required' ? copy.errors[state.error] ?? copy.errors['connection-failed'] : undefined);
  const alert = error ? <View accessibilityRole="alert" style={s.notice}><Text variant="supporting" tone="warning">{error}</Text></View> : null;
  const strip = state.connectivity.state === 'LOCAL_ONLY' && network
    ? <View style={s.notice}><View style={s.row}><Icon name="cloud-offline-outline" tint={color.warning} /><Text style={s.fill} variant="button" tone="warning">{copy.internetDown}</Text></View>{!typing && <Text variant="supporting">{copy.localAvailable}</Text>}</View>
    : !network ? <View style={s.notice}><View style={s.row}><Icon name="wifi" tint={color.warning} /><Text style={s.fill} variant="button" tone="warning">{copy.meshLost}</Text></View>{!typing && <Text variant="supporting">{copy.meshLostBody}</Text>}</View> : null;
  function field(label: string, value: string, change: (v: string) => void, multiline = false) {
    return <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={color.muted} style={[s.field, multiline && s.textarea]} maxFontSizeMultiplier={1.6} value={value} onChangeText={change} multiline={multiline} autoCorrect={false} autoCapitalize="none" maxLength={4096} />;
  }
  function messageItem({ item }: { item: ChatMessage }) {
    const request = item.paymentRequest ?? paymentRequest(item.text);
    const sender = item.own ? copy.you : item.senderName ?? (active?.kind === 'group' ? item.senderId : active?.name ?? item.senderId);
    const label = copy.messageLabel(sender, request ? copy.payment : item.text, time(item.timestamp), item.own ? copy.statuses[item.status] : copy.received);
    const statusIcon: Record<ChatMessage['status'], IconName> = { queued: 'time-outline', sending: 'ellipsis-horizontal', sent: 'checkmark-outline', delivered: 'checkmark-done-outline', read: 'checkmark-done-outline', failed: 'alert-circle-outline' };
    const content = <>
      {request ? <><Text variant="button" tone={item.own ? 'white' : 'ink'}>{copy.payment}</Text><Text variant="supporting" tone={item.own ? 'white' : 'muted'}>{copy.paymentHelp}</Text><Button label={copy.reviewPayment} kind="secondary" onPress={() => void perform(async () => { const outcome = await runtime!.pay(request); setNotice(copy.paymentStatuses[outcome.status]); })} /></> : <Text tone={item.own ? 'white' : 'ink'}>{item.text}</Text>}
      <View style={s.meta}><Text variant="label" tone={item.own ? 'white' : 'muted'}>{time(item.timestamp)}</Text>{item.own ? <><Icon name={statusIcon[item.status]} size={space.l} tint={color.white} /><Text variant="label" tone="white">{copy.statuses[item.status]}</Text></> : null}</View>
    </>;
    return item.status === 'failed' && !request
      ? <Pressable accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint={copy.retryMessage} onPress={retry} style={[s.message, item.own && s.own]}>{content}</Pressable>
      : <View accessible={!request} accessibilityLabel={request ? undefined : label} style={[s.message, item.own && s.own]}>{content}</View>;
  }
  function sheetBody() {
    if (sheet === 'new') return <>
      <Text accessibilityRole="header" variant="screen">{group ? copy.newGroup : copy.newChat}</Text>
      <View style={s.setting}><Text style={s.fill}>{copy.newGroup}</Text><Switch style={s.iconButton} accessibilityLabel={copy.newGroup} value={group} onValueChange={setGroup} /></View>
      {field(copy.name, name, setName)}{field(copy.users, users, setUsers, true)}
      <Button label={copy.create} disabled={!ready || !name.trim() || !users.trim()} busy={busy} onPress={() => void perform(async () => { const id = await runtime!.createRoom(name, users.split(',').map(u => u.trim()).filter(Boolean), group); setSheet(null); select(id); setName(''); setUsers(''); })} />
    </>;
    if (sheet === 'contact') return <>
      <Text accessibilityRole="header" variant="screen">{copy.contact}</Text><Text tone="muted">{copy.qrHelp}</Text>
      <Button label={copy.scanQr} kind="secondary" disabled={!ready || busy} onPress={() => void perform(async () => { const scanned = await runtime!.scanQr(); if (scanned) setContact(scanned); })} />
      {field(copy.contactName, name, setName)}{field(copy.qrLabel, contact, setContact, true)}
      <Button label={copy.addVerify} disabled={!ready || !contact.trim()} busy={busy} onPress={() => void perform(async () => { const result = await runtime!.addContact(contact); const id = await runtime!.createRoom(name.trim() || result.userId.split(':')[0]!, [result.userId], false); setSheet(null); select(id); setContact(''); setName(''); })} />
      <Button label={copy.ownQr} kind="secondary" disabled={!ready || busy} onPress={() => void perform(async () => { await runtime!.showOwnQr(); })} />
    </>;
    if (sheet === 'settings') return <>
      <Text accessibilityRole="header" variant="screen">{copy.privacy}</Text><Text variant="button">{copy.identity}</Text><Text tone="muted">{state.profile?.nickname ?? copy.integration}</Text>
      <View style={s.setting}><View style={s.fill}><Text>{copy.directory}</Text><Text variant="supporting" tone="muted">{copy.directoryBody}</Text></View><Switch style={s.iconButton} accessibilityLabel={copy.directory} value={state.directoryOptIn} disabled={!ready || busy} onValueChange={value => void perform(async () => { await runtime!.setDirectory(value); })} /></View>
      <View style={s.setting}><View style={s.fill}><Text>{copy.screenProtection}</Text><Text variant="supporting" tone="muted">{copy.screenProtectionBody}</Text></View><Switch style={s.iconButton} accessibilityLabel={copy.screenProtection} value={protection} disabled={!ready || busy} onValueChange={value => void perform(async () => { await runtime!.protectScreen(value); setProtection(value); })} /></View>
      <View style={s.row}><Icon name="lock-closed-outline" tint={color.forest} /><Text style={s.fill}>{ready ? copy.encrypted : copy.integration}</Text></View>
    </>;
    if (sheet === 'verify') return <><Text accessibilityRole="header" variant="screen">{copy.verify}</Text><Text>{copy.compare}</Text>{challenge?.emoji.map((emoji, i) => <Text key={i} accessibilityLabel={emoji.label}>{emoji.symbol} {emoji.label}</Text>)}<Button label={copy.match} disabled={!challenge || busy} onPress={() => void perform(async () => { await runtime!.confirmVerification(challenge!.id, true); setChallenge(null); setSheet(null); })} /><Button label={copy.mismatch} kind="secondary" disabled={!challenge || busy} onPress={() => void perform(async () => { await runtime!.confirmVerification(challenge!.id, false); setChallenge(null); setSheet(null); })} /></>;
    if (sheet === 'details' && active) return <>
      <Text accessibilityRole="header" variant="screen">{active.name}</Text><Text tone="muted">{active.kind === 'group' ? copy.members(active.members) : active.verification === 'verified' ? copy.verified : copy.unverified}</Text>
      {active.kind === 'group' ? <>{field(copy.inviteUser, users, setUsers)}<Button label={copy.invite} kind="secondary" disabled={!users.trim() || busy} onPress={() => void perform(async () => { await runtime!.invite(active.id, users.trim()); setUsers(''); setSheet(null); })} /><Button label={copy.leave} kind="secondary" onPress={() => Alert.alert(copy.leaveConfirm, undefined, [{ text: copy.cancel, style: 'cancel' }, { text: copy.leave, style: 'destructive', onPress: () => void perform(async () => { await runtime!.leave(active.id); select(null); setSheet(null); }) }])} /></> : <>
        <Button label={copy.verify} kind="secondary" onPress={() => void perform(async () => { if (!active.peerUserId) throw new ChatError('invalid-contact'); setChallenge(await runtime!.beginVerification(active.peerUserId)); setSheet('verify'); })} />
        <Button label={copy.block} kind="secondary" onPress={() => Alert.alert(copy.blockConfirm, undefined, [{ text: copy.cancel, style: 'cancel' }, { text: copy.block, style: 'destructive', onPress: () => void perform(async () => { if (!active.peerUserId) throw new ChatError('invalid-contact'); await runtime!.block(active.peerUserId); setSheet(null); select(null); }) }])} />
      </>}
      <Button label={copy.report} kind="quiet" onPress={() => setNotice(copy.reportPending)} />
    </>;
    return null;
  }
  if (!ready) {
    const needsMesh = !!runtime && !network && state.phase !== 'signed-out';
    const title = state.phase === 'signed-out' ? copy.signedOut : state.phase === 'connecting' ? copy.loading : needsMesh ? copy.needsMesh : state.phase === 'error' ? copy.unavailable : copy.integration;
    const body = state.phase === 'signed-out' ? copy.signedOutBody : needsMesh ? copy.needsMeshBody : state.phase === 'connecting' ? copy.connectingBody : state.phase === 'error' ? copy.errors[state.error ?? 'connection-failed'] ?? copy.errors['connection-failed']! : copy.integrationBody;
    return <View style={s.root}>{state.preview && <View style={s.preview}><Text variant="label" tone="warning">{copy.preview}</Text></View>}<ScrollView contentContainerStyle={s.landing}>
      <Text accessibilityRole="header" variant="welcome">{copy.chat}</Text>
      <View style={s.landingIcon}><Icon name="chatbubbles-outline" size={space.xxl} tint={color.forest} /></View>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" variant="screen">{title}</Text>
      <Text tone="muted">{copy.aboutChat}</Text>
      <View style={s.landingInfo}><View style={s.row}><Icon name={needsMesh ? 'wifi' : 'lock-closed-outline'} tint={color.forest} /><Text style={s.fill} variant="button" tone="forest">{needsMesh ? copy.needsMesh : state.phase === 'connecting' ? copy.loading : copy.comingSoon}</Text></View><Text>{body}</Text></View>
      {state.phase === 'connecting' && <ActivityIndicator color={color.forest} accessibilityLabel={copy.loading} />}
      {runtime && state.phase !== 'connecting' && state.phase !== 'signed-out' && <Button label={copy.retry} kind="secondary" onPress={retry} busy={busy} />}
      <Button label={copy.backHome} kind="secondary" onPress={ctx.exit} />
    </ScrollView></View>;
  }
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {state.preview ? <View style={s.preview}><Text variant="label" tone="warning">{copy.preview}</Text></View> : null}
    {active ? <>
      <View style={s.header}><View style={s.row}><Action icon="chevron-back" label={copy.chats} onPress={() => select(null)} />{!typing && <Avatar room={active} />}<View style={s.fill}><Text accessibilityRole="header" variant="section" numberOfLines={1}>{active.name}</Text>{!typing && <Text variant="label" tone={active.verification === 'verified' ? 'forest' : 'muted'}>{active.kind === 'group' ? copy.groupEncrypted : active.verification === 'verified' ? copy.verified : copy.unverified}</Text>}</View><Action icon="ellipsis-vertical" label={copy.details} onPress={() => show('details')} /></View></View>
      {strip}{alert}{active.verification === 'changed' ? <View style={s.notice}><Text tone="warning" variant="supporting">{copy.changed}</Text></View> : null}
      <FlatList testID="chat-messages" data={[...active.messages].reverse()} inverted keyExtractor={m => m.id} renderItem={messageItem} contentContainerStyle={s.messages} initialNumToRender={20} maxToRenderPerBatch={12} windowSize={7} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={busy} onRefresh={retry} tintColor={color.forest} />} ListFooterComponent={<View style={[s.row, { justifyContent: 'center', paddingBottom: space.l }]}><Icon name="lock-closed-outline" size={space.l} tint={color.muted} /><Text variant="label" tone="muted">{copy.encrypted}</Text></View>} />
      <View style={s.composer}><Action icon="add" label={copy.attach} disabled={!ready || !network || busy || active.verification === 'changed'} onPress={() => void perform(async () => { await runtime!.sendImage(active.id); })} /><TextInput testID="chat-composer" accessibilityLabel={copy.message(active.name)} placeholder={copy.message(active.name)} placeholderTextColor={color.muted} style={[s.input, s.composerInput, typing && s.typingInput]} maxFontSizeMultiplier={1.6} maxLength={CHAT_POLICY.maxMessageCharacters} value={draft} onChangeText={setDraft} editable={ready && active.verification !== 'changed'} multiline /><Pressable testID="chat-send" accessibilityRole="button" accessibilityLabel={copy.send} accessibilityState={{ disabled: !ready || busy || !draft.trim() || active.verification === 'changed' }} disabled={!ready || busy || !draft.trim() || active.verification === 'changed'} style={[s.iconButton, s.send, (!ready || !draft.trim()) && s.disabled]} onPress={() => void perform(async () => { await runtime!.send(active.id, draft); setDraft(''); })}><Icon name="arrow-up" tint={color.white} /></Pressable></View>
    </> : <>
      <View style={s.content}><View style={s.top}><View style={s.spread}><Text accessibilityRole="header" variant="welcome">{copy.chat}</Text><View style={s.row}><Action icon="scan-outline" label={copy.contact} onPress={() => show('contact')} /><Action icon="ellipsis-vertical" label={copy.privacy} onPress={() => show('settings')} /></View></View><View style={s.row}><View style={[s.networkIcon, !network && s.offlineIcon]}><Icon name={network ? "wifi" : "cloud-offline-outline"} tint={network ? color.white : color.warning} /></View><View style={s.rowText}><Text variant="button">{network ? copy.onMesh : copy.meshLost}</Text><Text variant="supporting" tone="muted">{network ? copy.local : copy.meshLostBody}</Text></View></View><View style={s.search}><Icon name="search" tint={color.muted} /><TextInput testID="chat-search" accessibilityLabel={copy.search} placeholder={copy.search} placeholderTextColor={color.muted} maxFontSizeMultiplier={1.6} style={s.input} value={search} onChangeText={setSearch} /></View><View style={s.row}>{(['all', 'unread', 'groups'] as const).map(key => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={copy[key]} accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={[s.filter, filter === key && s.selected]}><Text variant="button" tone={filter === key ? 'forest' : 'muted'}>{copy[key]}</Text></Pressable>)}</View></View>
        {alert}<FlatList testID="chat-inbox" data={state.rooms.filter(r => r.encrypted && (filter !== 'unread' || r.unread > 0) && (filter !== 'groups' || r.kind === 'group') && r.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))} keyExtractor={r => r.id} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7} contentContainerStyle={s.list} refreshControl={runtime ? <RefreshControl refreshing={busy} onRefresh={retry} tintColor={color.forest} /> : undefined} renderItem={({ item }) => <Pressable testID={`room-${item.id}`} accessibilityRole="button" accessibilityLabel={copy.roomLabel(item.name, item.unread, item.messages.at(-1)?.text ?? copy.encrypted, lastTime(item))} onPress={() => select(item.id)} style={s.chatRow}><Avatar room={item} /><View style={s.rowText}><Text variant="button" numberOfLines={1}>{item.name}</Text><Text variant="supporting" tone="muted" numberOfLines={1}>{item.verification === 'changed' ? copy.changed : item.messages.at(-1)?.text ?? copy.encrypted}</Text></View><View style={s.right}><Text variant="label" tone="muted">{lastTime(item)}</Text>{item.unread ? <View style={s.unread}><Text variant="label" tone="white">{item.unread}</Text></View> : null}</View></Pressable>} ListEmptyComponent={<View style={s.center}><Icon name="chatbubbles-outline" size={space.x3} tint={color.forest} /><Text variant="section" style={s.centeredText}>{search ? copy.noResults : copy.empty}</Text><Text tone="muted" style={s.centeredText}>{copy.emptyBody}</Text></View>} />
      </View><View style={[s.footer, (viewport.width < 8 * touchTarget || viewport.fontScale > 1.3) && s.stackedFooter]}><View style={s.encryption}><Icon name="lock-closed-outline" size={space.l} tint={color.muted} /><Text variant="label" tone="muted">{ready ? copy.encrypted : copy.integration}</Text></View><Pressable testID="chat-new" accessibilityRole="button" accessibilityLabel={copy.newChat} accessibilityState={{ disabled: !ready || !network }} disabled={!ready || !network} style={[s.compose, (!ready || !network) && s.disabled]} onPress={() => show('new')}><Icon name="create-outline" tint={color.white} /><Text variant="button" tone="white">{copy.newChat}</Text></Pressable></View>
    </>}
    <Modal visible={sheet !== null} animationType="slide" onRequestClose={close} presentationStyle="pageSheet"><Screen><Action icon="close" label={copy.back} onPress={close} />{state.preview ? <Text variant="label" tone="warning">{copy.preview}</Text> : null}{sheetBody()}{notice ? <Text accessibilityRole="alert" tone="warning">{notice}</Text> : null}</Screen></Modal>
  </KeyboardAvoidingView>;
}
