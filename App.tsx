import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { LayoutEditorScreen, MapViewerModal, OccupancyScreen } from './src/components/EventMap';
import { localGuestRepository } from './src/data/guestRepository';
import { localLayoutRepository } from './src/data/layoutRepository';
import { loadSyncedLayout, saveSyncedLayout, subscribeToLayout } from './src/data/syncedLayoutRepository';
import { deleteSyncedGuest, loadSyncedGuests, saveSyncedGuest, subscribeToGuests } from './src/data/syncedGuestRepository';
import { isSyncConfigured, setSessionPersistence, supabase } from './src/data/supabase';
import { createDefaultLayout, EventLayout } from './src/domain/eventLayout';
import {
  cleanGuestDraft, createGuest, findPossibleDuplicates, Guest, GuestDraft,
  GuestValidationErrors, groupSize, searchGuests, validateGuestDraft,
} from './src/domain/guest';

type Screen = 'search' | 'guests' | 'occupancy' | 'map';
type SyncState = 'local' | 'syncing' | 'online' | 'offline';
const C = { ink: '#17211B', muted: '#647067', line: '#DEE4DF', paper: '#FAF8F3', card: '#FFFFFF', green: '#245744', greenDark: '#183C30', greenSoft: '#E5EFE9', gold: '#C29148', goldSoft: '#F7EEDC', danger: '#A33D3D', dangerSoft: '#FCEAEA' };

export default function App() {
  const [screen, setScreen] = useState<Screen>('search');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [layout, setLayout] = useState<EventLayout>(() => createDefaultLayout());
  const [mapGuest, setMapGuest] = useState<Guest>();
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editorGuest, setEditorGuest] = useState<Guest | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Guest>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [authReady, setAuthReady] = useState(!isSyncConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(isSyncConfigured ? 'syncing' : 'local');

  const loadGuests = async () => {
    setLoading(true); setLoadError('');
    let cachedGuests: Guest[] = [];
    let cacheError = '';
    try { cachedGuests = await localGuestRepository.load(); setGuests(cachedGuests); }
    catch (error) { cacheError = error instanceof Error ? error.message : 'Não foi possível abrir a lista.'; }

    if (isSyncConfigured && session) {
      setSyncState('syncing');
      try {
        const syncedGuests = await loadSyncedGuests();
        setGuests(syncedGuests);
        await localGuestRepository.save(syncedGuests);
        setSyncState('online');
      } catch {
        setSyncState('offline');
        if (!cachedGuests.length && cacheError) setLoadError(cacheError);
      }
    } else if (cacheError) setLoadError(cacheError);
    setLoading(false);
  };

  const loadLayout = async () => {
    const cachedLayout = await localLayoutRepository.load();
    setLayout(cachedLayout);
    if (!isSyncConfigured || !session) return;
    try {
      const syncedLayout = await loadSyncedLayout();
      if (syncedLayout) {
        setLayout(syncedLayout);
        await localLayoutRepository.save(syncedLayout);
      } else {
        await saveSyncedLayout(cachedLayout);
      }
    } catch {
      // O mapa local continua disponível quando o banco ainda não foi atualizado.
    }
  };

  useEffect(() => {
    if (!isSyncConfigured || !supabase) return;
    const client = supabase;
    void client.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || (isSyncConfigured && !session)) { setLoading(false); return; }
    void Promise.all([loadGuests(), loadLayout()]);
  }, [authReady, session?.user.id]);

  useEffect(() => {
    if (!isSyncConfigured || !session) return;
    const refresh = () => {
      void loadSyncedGuests().then(async (syncedGuests) => {
        setGuests(syncedGuests);
        await localGuestRepository.save(syncedGuests);
        setSyncState('online');
      }).catch(() => setSyncState('offline'));
    };
    return subscribeToGuests(refresh, (online) => {
      if (online) refresh();
      else setSyncState('offline');
    });
  }, [session?.user.id]);

  useEffect(() => {
    if (!isSyncConfigured || !session) return;
    const refresh = () => { void loadSyncedLayout().then(async (nextLayout) => {
      if (!nextLayout) return;
      setLayout(nextLayout);
      await localLayoutRepository.save(nextLayout);
    }); };
    return subscribeToLayout(refresh);
  }, [session?.user.id]);

  const results = useMemo(() => hasSearched ? searchGuests(guests, query) : [], [guests, hasSearched, query]);
  const sortedGuests = useMemo(() => searchGuests(guests, ''), [guests]);
  const persistLocal = async (next: Guest[]) => { await localGuestRepository.save(next); setGuests(next); };
  const saveLayout = async (nextLayout: EventLayout) => {
    if (isSyncConfigured) {
      setSyncState('syncing');
      try { await saveSyncedLayout(nextLayout); setSyncState('online'); }
      catch (error) { setSyncState('offline'); throw error; }
    }
    await localLayoutRepository.save(nextLayout);
    setLayout(nextLayout);
  };
  const saveGuest = async (draft: GuestDraft, guest?: Guest) => {
    const cleaned = cleanGuestDraft(draft);
    const nextGuest = guest ? { ...guest, ...cleaned, updatedAt: new Date().toISOString() } : createGuest(cleaned);
    const nextGuests = guest ? guests.map((item) => item.id === guest.id ? nextGuest : item) : [...guests, nextGuest];
    if (isSyncConfigured) {
      setSyncState('syncing');
      try { await saveSyncedGuest(nextGuest); setSyncState('online'); }
      catch (error) { setSyncState('offline'); throw error; }
    }
    await persistLocal(nextGuests);
    setEditorGuest(undefined);
  };
  const requestDeleteGuest = (guest: Guest) => { setDeleteError(''); setPendingDelete(guest); };
  const confirmDeleteGuest = async () => {
    if (!pendingDelete || deleteBusy) return;
    setDeleteBusy(true); setDeleteError('');
    try {
      if (isSyncConfigured) { setSyncState('syncing'); await deleteSyncedGuest(pendingDelete.id); setSyncState('online'); }
      await persistLocal(guests.filter((item) => item.id !== pendingDelete.id));
      setPendingDelete(undefined);
    } catch {
      setSyncState('offline');
      setDeleteError('Não foi possível excluir. Confira a conexão e tente novamente.');
    } finally { setDeleteBusy(false); }
  };
  const toggleCheckIn = async (guest: Guest) => {
    const nextGuest = { ...guest, checkedIn: !guest.checkedIn, updatedAt: new Date().toISOString() };
    const nextGuests = guests.map((item) => item.id === guest.id ? nextGuest : item);
    try {
      if (isSyncConfigured) { setSyncState('syncing'); await saveSyncedGuest(nextGuest); setSyncState('online'); }
      await persistLocal(nextGuests);
    } catch {
      setSyncState('offline');
      Alert.alert('Não foi possível atualizar o check-in', 'Confira a conexão e tente novamente.');
    }
  };
  const signOut = async () => {
    if (!supabase || signOutBusy) return;
    setSignOutBusy(true);
    try {
      await supabase.auth.signOut({ scope: 'local' });
      setScreen('search');
      setQuery('');
      setHasSearched(false);
      setSignOutOpen(false);
    } finally { setSignOutBusy(false); }
  };
  const { totalPeople, checkedInPeople } = useMemo(() => guests.reduce((totals, guest) => {
    const people = groupSize(guest);
    totals.totalPeople += people;
    if (guest.checkedIn) totals.checkedInPeople += people;
    return totals;
  }, { totalPeople: 0, checkedInPeople: 0 }), [guests]);

  if (!authReady || loading) return <SafeAreaView style={s.center}><StatusBar style="dark" /><ActivityIndicator size="large" color={C.green} /><Text style={s.loadingText}>Abrindo a lista de convidados…</Text></SafeAreaView>;
  if (isSyncConfigured && !session) return <LoginScreen />;
  if (loadError) return <SafeAreaView style={s.center}><StatusBar style="dark" /><View style={s.errorIcon}><Text style={s.errorIconText}>!</Text></View><Text style={s.errorTitle}>Não foi possível abrir a lista</Text><Text style={s.errorText}>{loadError}</Text><Button label="Tentar novamente" onPress={() => void loadGuests()} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.page}>
      <StatusBar style="dark" />
      <View style={s.frame}>
        <Header guests={guests.length} people={totalPeople} present={checkedInPeople} />
        <SyncBar state={syncState} onSignOut={session ? () => setSignOutOpen(true) : undefined} />
        {screen === 'search' ? (
          <SearchScreen query={query} setQuery={(v) => { setQuery(v); if (!v.trim()) setHasSearched(false); }} searched={hasSearched} results={results} onSearch={() => { Keyboard.dismiss(); setHasSearched(true); }} onClear={() => { setQuery(''); setHasSearched(false); }} onEdit={setEditorGuest} onOpenMap={setMapGuest} onToggleCheckIn={(guest) => void toggleCheckIn(guest)} onAdd={() => setEditorGuest(null)} />
        ) : screen === 'guests' ? (
          <GuestsScreen guests={sortedGuests} onAdd={() => setEditorGuest(null)} onEdit={setEditorGuest} onDelete={requestDeleteGuest} onToggleCheckIn={(guest) => void toggleCheckIn(guest)} />
        ) : screen === 'occupancy' ? (
          <OccupancyScreen layout={layout} guests={guests} />
        ) : (
          <LayoutEditorScreen layout={layout} onSave={saveLayout} />
        )}
        <Navigation screen={screen} onChange={setScreen} />
      </View>
      <GuestEditor visible={editorGuest !== undefined} guest={editorGuest ?? undefined} guests={guests} onClose={() => setEditorGuest(undefined)} onSave={saveGuest} />
      <MapViewerModal guest={mapGuest} layout={layout} onClose={() => setMapGuest(undefined)} />
      <DeleteGuestModal busy={deleteBusy} error={deleteError} guest={pendingDelete} onCancel={() => { if (!deleteBusy) setPendingDelete(undefined); }} onConfirm={() => void confirmDeleteGuest()} />
      <SignOutModal busy={signOutBusy} visible={signOutOpen} onCancel={() => { if (!signOutBusy) setSignOutOpen(false); }} onConfirm={() => void signOut()} />
    </SafeAreaView>
  );
}

function Header({ guests, people, present }: { guests: number; people: number; present: number }) {
  const compact = useWindowDimensions().width < 430;
  return <View style={[s.header, compact && s.headerCompact]}><View style={compact && s.brandCompact}><Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={[s.eyebrow, compact && s.eyebrowCompact]}>RECEPÇÃO</Text><Text numberOfLines={1} style={[s.brand, compact && s.brandTextCompact]}>Jantar</Text></View><View style={[s.stats, compact && s.statsCompact]}><Stat value={guests} label="grupos" /><View style={s.statDivider} /><Stat value={people} label="previstas" /><View style={s.statDivider} /><Stat value={present} label="presentes" /></View></View>;
}
function Stat({ value, label }: { value: number; label: string }) { return <View style={s.stat}><Text style={s.statNumber}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>; }

function SyncBar({ state, onSignOut }: { state: SyncState; onSignOut?: () => void }) {
  const labels: Record<SyncState, string> = {
    local: 'Modo local de teste',
    syncing: 'Sincronizando…',
    online: 'Lista sincronizada',
    offline: 'Sem conexão · exibindo a última lista',
  };
  return <View style={[s.syncBar, state === 'offline' && s.syncBarOffline, state === 'local' && s.syncBarLocal]}><View style={[s.syncDot, state === 'online' && s.syncDotOnline, state === 'offline' && s.syncDotOffline]} /><Text style={s.syncText}>{labels[state]}</Text>{onSignOut && <Pressable accessibilityLabel="Sair para a tela de login" accessibilityRole="button" onPress={onSignOut} style={s.signOut}><Text style={s.signOutText}>↪ Sair</Text></Pressable>}</View>;
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(true);

  const signIn = async () => {
    if (!supabase || !email.trim() || !password) return;
    setBusy(true); setError('');
    setSessionPersistence(remember);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) { setError('E-mail ou senha incorretos.'); setBusy(false); }
  };

  return <SafeAreaView style={s.loginPage}><StatusBar style="light" /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.loginPage}><ScrollView contentContainerStyle={s.loginContent} keyboardShouldPersistTaps="handled"><Image accessibilityLabel="Brasão do 4º RCB" resizeMode="contain" source={require('./assets/logo.png')} style={s.loginLogo} /><Text style={s.loginEyebrow}>RECEPÇÃO DO JANTAR</Text><Text style={s.loginTitle}>Acesso da equipe</Text><Text style={s.loginSubtitle}>Entre para acessar a lista sincronizada de convidados.</Text><View style={s.loginCard}><Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="E-mail" onChangeText={setEmail} placeholder="equipe@evento.com" value={email} /><Field autoCapitalize="none" autoComplete="password" label="Senha" onChangeText={setPassword} onSubmitEditing={() => void signIn()} placeholder="Sua senha" secureTextEntry value={password} /><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} onPress={() => setRemember((current) => !current)} style={s.rememberRow}><View style={[s.checkbox, remember && s.checkboxChecked]}><Text style={s.checkboxMark}>{remember ? '✓' : ''}</Text></View><View style={s.rememberTextBlock}><Text style={s.rememberTitle}>Manter conectado neste aparelho</Text><Text style={s.rememberHelp}>{remember ? 'Você não precisará entrar novamente ao abrir o aplicativo.' : 'A sessão será encerrada quando o aplicativo for fechado.'}</Text></View></Pressable>{!!error && <Text style={s.loginError}>{error}</Text>}<Button label={busy ? 'Entrando…' : 'Entrar'} onPress={() => void signIn()} disabled={busy || !email.trim() || !password} /></View><Text style={s.loginHelp}>O acesso é fornecido pelo responsável do evento.</Text></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

type SearchProps = { query: string; setQuery: (v: string) => void; searched: boolean; results: Guest[]; onSearch: () => void; onClear: () => void; onEdit: (g: Guest) => void; onOpenMap: (g: Guest) => void; onToggleCheckIn: (g: Guest) => void; onAdd: () => void };
function SearchScreen({ query, setQuery, searched, results, onSearch, onClear, onEdit, onOpenMap, onToggleCheckIn, onAdd }: SearchProps) {
  const compact = useWindowDimensions().width < 380;
  return <View style={s.screen}><FlatList data={results} keyExtractor={(item) => item.id} contentContainerStyle={s.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" initialNumToRender={8} maxToRenderPerBatch={8} removeClippedSubviews={Platform.OS === 'android'} updateCellsBatchingPeriod={40} windowSize={7}
    ListHeaderComponent={<><Text style={s.title}>Encontre um convidado</Text><Text style={s.subtitle}>Digite o nome ou a função para consultar a mesa e o grupo.</Text><View style={[s.searchRow, compact && s.searchRowCompact]}><View style={s.searchBox}><Text style={s.searchGlyph}>⌕</Text><TextInput accessibilityLabel="Nome ou função do convidado" autoCapitalize="words" autoCorrect={false} onChangeText={setQuery} onSubmitEditing={onSearch} placeholder="Nome ou função" placeholderTextColor="#899188" returnKeyType="search" style={s.searchInput} value={query} />{!!query && <Pressable accessibilityLabel="Limpar busca" onPress={onClear} style={s.clear}><Text style={s.clearText}>×</Text></Pressable>}</View><Button label="Buscar" onPress={onSearch} compact disabled={!query.trim()} /></View>{searched && <Text style={s.resultCount}>{results.length === 1 ? '1 resultado encontrado' : `${results.length} resultados encontrados`}</Text>}</>}
    renderItem={({ item }) => <ResultCard guest={item} onEdit={() => onEdit(item)} onOpenMap={() => onOpenMap(item)} onToggleCheckIn={() => onToggleCheckIn(item)} />}
    ListEmptyComponent={searched ? <Empty title="Nenhum convidado encontrado" text="Confira o nome ou a função, ou cadastre esta pessoa na lista." action="Cadastrar convidado" onPress={onAdd} /> : <View style={s.welcome}><Text style={s.welcomeKicker}>CONSULTA RÁPIDA</Text><Text style={s.welcomeTitle}>A mesa certa, sem demora.</Text><Text style={s.welcomeText}>A busca encontra partes do nome ou da função e ignora diferenças de acentos e letras maiúsculas.</Text></View>}
  /></View>;
}

function ResultCard({ guest, onEdit, onOpenMap, onToggleCheckIn }: { guest: Guest; onEdit: () => void; onOpenMap: () => void; onToggleCheckIn: () => void }) {
  const people = groupSize(guest);
  return <View style={s.resultCard}><View style={s.resultTop}><Pressable accessibilityRole="button" onPress={onOpenMap} style={s.nameBlock}><Text style={s.resultName}>{guest.name}</Text><Text style={s.roleText}>{guest.role}</Text><Text style={s.groupSummary}>{guest.companions === 0 ? 'Sem acompanhantes' : `${guest.companions} ${guest.companions === 1 ? 'acompanhante' : 'acompanhantes'}`} · {people} {people === 1 ? 'pessoa' : 'pessoas'} no grupo</Text><Text style={[s.checkStatus, guest.checkedIn && s.checkStatusDone]}>{guest.checkedIn ? `✓ Check-in realizado · ${people} presentes` : 'Ainda não chegou'}</Text><Text style={s.nameHint}>Toque para localizar no mapa</Text></Pressable><View style={s.cardActions}><Pressable onPress={onEdit} style={s.smallAction}><Text style={s.smallActionText}>Editar</Text></Pressable><Pressable onPress={onToggleCheckIn} style={[s.smallAction, guest.checkedIn && s.undoAction]}><Text style={[s.smallActionText, guest.checkedIn && s.undoActionText]}>{guest.checkedIn ? 'Desfazer' : 'Check-in'}</Text></Pressable></View></View><Pressable onPress={onOpenMap} style={s.tablePanel}><View><Text style={s.tableLabel}>MESA</Text><Text style={s.tableNumber}>{guest.table}</Text></View><View style={s.mapPlaceholder}><Text style={s.mapTitle}>Ver no mapa</Text><Text style={s.mapText}>Toque para destacar a localização</Text></View></Pressable></View>;
}

function GuestsScreen({ guests, onAdd, onEdit, onDelete, onToggleCheckIn }: { guests: Guest[]; onAdd: () => void; onEdit: (g: Guest) => void; onDelete: (g: Guest) => void; onToggleCheckIn: (g: Guest) => void }) {
  const compact = useWindowDimensions().width < 500;
  return <View style={s.screen}><FlatList data={guests} keyExtractor={(item) => item.id} contentContainerStyle={s.guestContent} initialNumToRender={12} maxToRenderPerBatch={10} removeClippedSubviews={Platform.OS === 'android'} updateCellsBatchingPeriod={40} windowSize={7}
    ListHeaderComponent={<View style={s.listHeading}><View style={s.listHeadingText}><Text style={s.title}>Convidados</Text><Text style={s.subtitle}>Cadastre e organize a lista do jantar.</Text></View><Button label="+ Novo" onPress={onAdd} compact /></View>}
    renderItem={({ item }) => <View style={[s.listCard, compact && s.listCardCompact]}><View style={s.listMain}><View style={[s.avatar, item.checkedIn && s.avatarChecked]}><Text style={[s.avatarText, item.checkedIn && s.avatarTextChecked]}>{item.checkedIn ? '✓' : item.name.charAt(0).toUpperCase()}</Text></View><View style={s.listBody}><Text numberOfLines={2} style={s.listName}>{item.name}</Text><Text numberOfLines={1} style={s.listRole}>{item.role}</Text><Text style={s.listMeta}>Mesa {item.table} · {item.companions} {item.companions === 1 ? 'acompanhante' : 'acompanhantes'} · {item.checkedIn ? 'presente' : 'aguardando'}</Text></View></View><View style={[s.listActions, compact && s.listActionsCompact]}><Pressable accessibilityLabel={`${item.checkedIn ? 'Desfazer check-in de' : 'Fazer check-in de'} ${item.name}`} accessibilityRole="button" hitSlop={5} onPress={() => onToggleCheckIn(item)} style={[s.iconButton, item.checkedIn && s.checkedButton]}><Text style={[s.iconText, item.checkedIn && s.checkedButtonText]}>✓</Text></Pressable><Pressable accessibilityLabel={`Editar ${item.name}`} accessibilityRole="button" hitSlop={5} onPress={() => onEdit(item)} style={s.iconButton}><Text style={s.iconText}>✎</Text></Pressable><Pressable accessibilityLabel={`Excluir ${item.name}`} accessibilityRole="button" hitSlop={5} onPress={() => onDelete(item)} style={[s.iconButton, s.deleteButton]}><Text style={s.deleteText}>×</Text></Pressable></View></View>}
    ListEmptyComponent={<Empty title="Sua lista está vazia" text="Cadastre o primeiro convidado para começar." action="Cadastrar convidado" onPress={onAdd} />}
  /></View>;
}

function GuestEditor({ visible, guest, guests, onClose, onSave }: { visible: boolean; guest?: Guest; guests: Guest[]; onClose: () => void; onSave: (d: GuestDraft, g?: Guest) => Promise<void> }) {
  const [name, setName] = useState(''); const [role, setRole] = useState(''); const [companionsText, setCompanionsText] = useState('0'); const [table, setTable] = useState(''); const [errors, setErrors] = useState<GuestValidationErrors>({}); const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) { setName(guest?.name ?? ''); setRole(guest?.role ?? ''); setCompanionsText(String(guest?.companions ?? 0)); setTable(guest?.table ?? ''); setErrors({}); setSaving(false); } }, [visible, guest]);
  const companions = companionsText === '' ? Number.NaN : Number(companionsText);
  const duplicates = findPossibleDuplicates(guests, name, guest?.id);
  const submit = async () => { const draft = { name, role, companions, table }; const nextErrors = validateGuestDraft(draft); setErrors(nextErrors); if (Object.keys(nextErrors).length) return; setSaving(true); try { await onSave(draft, guest); } catch { Alert.alert('Não foi possível salvar', 'Confira o aparelho e tente novamente.'); setSaving(false); } };
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}><SafeAreaView style={s.modalPage}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalPage}><View style={s.modalHeader}><Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancelar</Text></Pressable><Text style={s.modalTitle}>{guest ? 'Editar convidado' : 'Novo convidado'}</Text><View style={s.headerSpacer} /></View><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled"><Field autoCapitalize="words" autoFocus error={errors.name} label="Nome do convidado" onChangeText={setName} placeholder="Ex.: Maria Aparecida Silva" value={name} />{!!duplicates.length && <View style={s.warning}><Text style={s.warningTitle}>Já existe alguém com este nome</Text><Text style={s.warningText}>{duplicates.map((item) => `${item.name} — mesa ${item.table}`).join('\n')}</Text></View>}<Field autoCapitalize="words" error={errors.role} label="Função do convidado" maxLength={60} onChangeText={setRole} placeholder="Ex.: Homenageado, Cerimonial ou Convidado" value={role} /><View style={s.formRow}><View style={s.formHalf}><Field error={errors.companions} keyboardType="number-pad" label="Acompanhantes" maxLength={2} onChangeText={(v) => setCompanionsText(v.replace(/[^0-9]/g, ''))} placeholder="0" value={companionsText} /></View><View style={s.formHalf}><Field autoCapitalize="characters" error={errors.table} label="Mesa" maxLength={30} onChangeText={setTable} placeholder="Ex.: 12 ou A3" value={table} /></View></View><View style={s.preview}><Text style={s.previewLabel}>TAMANHO DO GRUPO</Text><Text style={s.previewNumber}>{Number.isInteger(companions) ? companions + 1 : '—'}</Text><Text style={s.previewText}>convidado principal + acompanhantes</Text></View><Button label={saving ? 'Salvando…' : guest ? 'Salvar alterações' : 'Cadastrar convidado'} onPress={() => void submit()} disabled={saving} /></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}

function DeleteGuestModal({ guest, busy, error, onCancel, onConfirm }: { guest?: Guest; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  return <Modal animationType="fade" onRequestClose={onCancel} transparent visible={Boolean(guest)}><View style={s.confirmBackdrop}><View style={s.confirmCard}><View style={s.confirmIcon}><Text style={s.confirmIconText}>!</Text></View><Text style={s.confirmTitle}>Excluir convidado?</Text>{guest && <><Text style={s.confirmName}>{guest.name}</Text><Text style={s.confirmText}>Este cadastro e seus {guest.companions} {guest.companions === 1 ? 'acompanhante' : 'acompanhantes'} serão removidos definitivamente da lista.</Text></>}{!!error && <Text style={s.confirmError}>{error}</Text>}<View style={s.confirmActions}><Pressable disabled={busy} onPress={onCancel} style={[s.confirmButton, s.confirmCancel, busy && s.buttonDisabled]}><Text style={s.confirmCancelText}>Cancelar</Text></Pressable><Pressable disabled={busy} onPress={onConfirm} style={[s.confirmButton, s.confirmDelete, busy && s.buttonDisabled]}><Text style={s.confirmDeleteText}>{busy ? 'Excluindo…' : 'Excluir'}</Text></Pressable></View></View></View></Modal>;
}

function SignOutModal({ visible, busy, onCancel, onConfirm }: { visible: boolean; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}><View style={s.confirmBackdrop}><View style={s.confirmCard}><View style={s.signOutIcon}><Text style={s.signOutIconText}>↪</Text></View><Text style={s.confirmTitle}>Sair do aplicativo?</Text><Text style={s.confirmText}>Você voltará para a tela de login deste aparelho.</Text><View style={s.confirmActions}><Pressable disabled={busy} onPress={onCancel} style={[s.confirmButton, s.confirmCancel, busy && s.buttonDisabled]}><Text style={s.confirmCancelText}>Cancelar</Text></Pressable><Pressable disabled={busy} onPress={onConfirm} style={[s.confirmButton, s.confirmDelete, busy && s.buttonDisabled]}><Text style={s.confirmDeleteText}>{busy ? 'Saindo…' : 'Sair'}</Text></Pressable></View></View></View></Modal>;
}

function Field({ label, error, ...props }: React.ComponentProps<typeof TextInput> & { label: string; error?: string }) { return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput {...props} placeholderTextColor="#92998F" style={[s.fieldInput, !!error && s.fieldInputError, props.style]} />{!!error && <Text style={s.fieldError}>{error}</Text>}</View>; }
function Button({ label, onPress, compact, disabled }: { label: string; onPress: () => void; compact?: boolean; disabled?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, compact && s.buttonCompact, disabled && s.buttonDisabled, pressed && !disabled && s.buttonPressed]}><Text style={s.buttonText}>{label}</Text></Pressable>; }
function Empty({ title, text, action, onPress }: { title: string; text: string; action: string; onPress: () => void }) { return <View style={s.empty}><Text style={s.emptySymbol}>＋</Text><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyText}>{text}</Text><Button label={action} onPress={onPress} /></View>; }
function Navigation({ screen, onChange }: { screen: Screen; onChange: (v: Screen) => void }) { return <View style={s.nav}><Nav active={screen === 'search'} icon="⌕" label="Buscar" onPress={() => onChange('search')} /><Nav active={screen === 'guests'} icon="♙" label="Convidados" onPress={() => onChange('guests')} /><Nav active={screen === 'occupancy'} icon="●" label="Ocupação" onPress={() => onChange('occupancy')} /><Nav active={screen === 'map'} icon="◇" label="Editar mapa" onPress={() => onChange('map')} /></View>; }
function Nav({ active, icon, label, onPress }: { active: boolean; icon: string; label: string; onPress: () => void }) { return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={s.navItem}><Text style={[s.navIcon, active && s.navActive]}>{icon}</Text><Text style={[s.navLabel, active && s.navActive]}>{label}</Text></Pressable>; }

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper }, frame: { flex: 1, width: '100%', maxWidth: 920, alignSelf: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: C.paper }, loadingText: { color: C.muted, fontSize: 15, marginTop: 16 },
  errorIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' }, errorIconText: { color: C.danger, fontSize: 26, fontWeight: '800' }, errorTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 18 }, errorText: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 24, marginTop: 8, textAlign: 'center' },
  header: { minHeight: 88, paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerCompact: { minHeight: 74, paddingHorizontal: 14, paddingVertical: 9 }, brandCompact: { flexShrink: 0, width: 78 }, brandTextCompact: { fontSize: 21 }, eyebrow: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.2 }, eyebrowCompact: { fontSize: 9, letterSpacing: 1.45 }, brand: { color: C.ink, fontSize: 26, fontWeight: '700' }, stats: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8 }, statsCompact: { flex: 1, justifyContent: 'space-around', paddingHorizontal: 4, paddingVertical: 6 }, stat: { alignItems: 'center', flexShrink: 1, minWidth: 54 }, statNumber: { color: C.green, fontSize: 17, fontWeight: '800' }, statLabel: { color: C.muted, fontSize: 10 }, statDivider: { backgroundColor: C.line, width: 1, marginHorizontal: 2 },
  syncBar: { alignItems: 'center', backgroundColor: '#EEF5F0', borderBottomColor: C.line, borderBottomWidth: 1, flexDirection: 'row', minHeight: 38, paddingHorizontal: 22 }, syncBarOffline: { backgroundColor: C.goldSoft }, syncBarLocal: { backgroundColor: '#F2F1ED' }, syncDot: { backgroundColor: C.gold, borderRadius: 4, height: 8, marginRight: 8, width: 8 }, syncDotOnline: { backgroundColor: '#3C9A6B' }, syncDotOffline: { backgroundColor: '#C7743E' }, syncText: { color: C.muted, flex: 1, fontSize: 11, fontWeight: '600' }, signOut: { paddingHorizontal: 6, paddingVertical: 7 }, signOutText: { color: C.green, fontSize: 11, fontWeight: '700' },
  loginPage: { flex: 1, backgroundColor: C.greenDark }, loginContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 24 }, loginLogo: { height: 118, width: 128 }, loginEyebrow: { color: '#C9D9D1', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 18 }, loginTitle: { color: '#FFF', fontSize: 29, fontWeight: '700', marginTop: 8 }, loginSubtitle: { color: '#C9D9D1', fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 380, textAlign: 'center' }, loginCard: { backgroundColor: C.paper, borderRadius: 18, marginTop: 26, maxWidth: 430, padding: 22, width: '100%' }, rememberRow: { alignItems: 'flex-start', flexDirection: 'row', marginBottom: 19, marginTop: -2 }, checkbox: { alignItems: 'center', borderColor: C.line, borderRadius: 6, borderWidth: 2, height: 23, justifyContent: 'center', marginRight: 10, marginTop: 1, width: 23 }, checkboxChecked: { backgroundColor: C.green, borderColor: C.green }, checkboxMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, rememberTextBlock: { flex: 1 }, rememberTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, rememberHelp: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 2 }, loginError: { color: C.danger, fontSize: 12, marginBottom: 15, marginTop: -6, textAlign: 'center' }, loginHelp: { color: '#AFC4BA', fontSize: 11, marginTop: 18 },
  screen: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 32, paddingTop: 28 }, guestContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 32, paddingTop: 25 }, title: { color: C.ink, fontSize: 27, fontWeight: '700' }, subtitle: { color: C.muted, fontSize: 15, lineHeight: 21, marginTop: 5 },
  searchRow: { flexDirection: 'row', gap: 10, marginTop: 22 }, searchRowCompact: { alignItems: 'stretch', flexDirection: 'column' }, searchBox: { flex: 1, minHeight: 52, backgroundColor: C.card, borderColor: C.line, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, searchGlyph: { color: C.green, fontSize: 25, marginLeft: 14 }, searchInput: { flex: 1, color: C.ink, fontSize: 16, paddingHorizontal: 10, paddingVertical: 13 }, clear: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center' }, clearText: { color: C.muted, fontSize: 25 },
  button: { minHeight: 52, backgroundColor: C.green, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 13 }, buttonCompact: { minHeight: 48, paddingHorizontal: 18 }, buttonDisabled: { opacity: 0.45 }, buttonPressed: { backgroundColor: C.greenDark, transform: [{ scale: 0.985 }] }, buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' }, resultCount: { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 10, marginTop: 24, textTransform: 'uppercase' },
  resultCard: { backgroundColor: C.card, borderColor: C.line, borderRadius: 18, borderWidth: 1, marginBottom: 13, overflow: 'hidden' }, resultTop: { flexDirection: 'row', padding: 18 }, nameBlock: { flex: 1, paddingRight: 10 }, resultName: { color: C.ink, fontSize: 19, fontWeight: '700' }, roleText: { color: C.gold, fontSize: 12, fontWeight: '700', marginTop: 4 }, groupSummary: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5 }, checkStatus: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 7 }, checkStatusDone: { color: '#2D875D' }, nameHint: { color: C.green, fontSize: 11, fontWeight: '700', marginTop: 8 }, cardActions: { gap: 7 }, smallAction: { alignItems: 'center', borderRadius: 9, backgroundColor: C.greenSoft, paddingHorizontal: 11, paddingVertical: 8 }, smallActionText: { color: C.green, fontSize: 12, fontWeight: '700' }, undoAction: { backgroundColor: C.dangerSoft }, undoActionText: { color: C.danger },
  tablePanel: { backgroundColor: C.green, flexDirection: 'row', minHeight: 92, padding: 17, alignItems: 'center' }, tableLabel: { color: '#BFD5CA', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, tableNumber: { color: '#FFF', fontSize: 29, fontWeight: '800' }, mapPlaceholder: { flex: 1, marginLeft: 24, borderLeftColor: '#4D7464', borderLeftWidth: 1, paddingLeft: 18 }, mapTitle: { color: '#FFF', fontSize: 13, fontWeight: '600' }, mapText: { color: '#BFD5CA', fontSize: 11, marginTop: 3 },
  welcome: { backgroundColor: C.greenSoft, borderRadius: 18, marginTop: 32, padding: 24, minHeight: 180, justifyContent: 'center' }, welcomeKicker: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 }, welcomeTitle: { color: C.greenDark, fontSize: 23, fontWeight: '700', marginTop: 9 }, welcomeText: { color: '#4F6258', fontSize: 14, lineHeight: 21, marginTop: 9 },
  empty: { alignItems: 'center', backgroundColor: C.card, borderColor: C.line, borderRadius: 18, borderWidth: 1, marginTop: 26, padding: 30 }, emptySymbol: { color: C.gold, fontSize: 38 }, emptyTitle: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 8, textAlign: 'center' }, emptyText: { color: C.muted, fontSize: 14, marginBottom: 20, marginTop: 6, textAlign: 'center' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }, listHeadingText: { flex: 1 }, listCard: { alignItems: 'center', backgroundColor: C.card, borderColor: C.line, borderRadius: 14, borderWidth: 1, flexDirection: 'row', marginBottom: 10, padding: 12 }, listCardCompact: { alignItems: 'stretch', flexDirection: 'column' }, listMain: { alignItems: 'center', flex: 1, flexDirection: 'row' }, listActions: { flexDirection: 'row' }, listActionsCompact: { alignSelf: 'flex-end', marginTop: 10 }, avatar: { alignItems: 'center', backgroundColor: C.greenSoft, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, avatarChecked: { backgroundColor: '#2D875D' }, avatarText: { color: C.green, fontSize: 16, fontWeight: '800' }, avatarTextChecked: { color: '#FFFFFF' }, listBody: { flex: 1, marginLeft: 12, minWidth: 0 }, listName: { color: C.ink, fontSize: 15, fontWeight: '700' }, listRole: { color: C.gold, fontSize: 11, fontWeight: '700', marginTop: 3 }, listMeta: { color: C.muted, fontSize: 12, marginTop: 4 }, iconButton: { alignItems: 'center', backgroundColor: C.greenSoft, borderRadius: 9, height: 38, justifyContent: 'center', marginLeft: 7, width: 38 }, iconText: { color: C.green, fontSize: 19 }, checkedButton: { backgroundColor: '#2D875D' }, checkedButtonText: { color: '#FFFFFF' }, deleteButton: { backgroundColor: C.dangerSoft }, deleteText: { color: C.danger, fontSize: 24 },
  nav: { backgroundColor: C.card, borderTopColor: C.line, borderTopWidth: 1, flexDirection: 'row', minHeight: 69 }, navItem: { alignItems: 'center', flex: 1, justifyContent: 'center' }, navIcon: { color: '#889087', fontSize: 23 }, navLabel: { color: '#7B857D', fontSize: 11, fontWeight: '600', marginTop: 3 }, navActive: { color: C.green, fontWeight: '800' },
  modalPage: { flex: 1, backgroundColor: C.paper }, modalHeader: { alignItems: 'center', borderBottomColor: C.line, borderBottomWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: 18 }, cancel: { paddingVertical: 10, width: 80 }, cancelText: { color: C.green, fontSize: 14, fontWeight: '600' }, modalTitle: { color: C.ink, flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' }, headerSpacer: { width: 80 }, form: { alignSelf: 'center', maxWidth: 680, paddingBottom: 40, paddingHorizontal: 22, paddingTop: 26, width: '100%' },
  confirmBackdrop: { alignItems: 'center', backgroundColor: 'rgba(18, 28, 23, 0.55)', flex: 1, justifyContent: 'center', padding: 22 }, confirmCard: { alignItems: 'center', backgroundColor: C.card, borderRadius: 18, maxWidth: 420, padding: 24, width: '100%' }, confirmIcon: { alignItems: 'center', backgroundColor: C.dangerSoft, borderRadius: 25, height: 50, justifyContent: 'center', width: 50 }, confirmIconText: { color: C.danger, fontSize: 25, fontWeight: '900' }, signOutIcon: { alignItems: 'center', backgroundColor: C.goldSoft, borderRadius: 25, height: 50, justifyContent: 'center', width: 50 }, signOutIconText: { color: C.gold, fontSize: 26, fontWeight: '900' }, confirmTitle: { color: C.ink, fontSize: 21, fontWeight: '800', marginTop: 14 }, confirmName: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 12, textAlign: 'center' }, confirmText: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' }, confirmError: { backgroundColor: C.dangerSoft, borderRadius: 9, color: C.danger, fontSize: 12, marginTop: 14, padding: 10, textAlign: 'center', width: '100%' }, confirmActions: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }, confirmButton: { alignItems: 'center', borderRadius: 11, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 }, confirmCancel: { backgroundColor: C.greenSoft }, confirmDelete: { backgroundColor: C.danger }, confirmCancelText: { color: C.green, fontSize: 14, fontWeight: '800' }, confirmDeleteText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  field: { marginBottom: 19 }, fieldLabel: { color: C.ink, fontSize: 13, fontWeight: '700', marginBottom: 8 }, fieldInput: { backgroundColor: C.card, borderColor: C.line, borderRadius: 12, borderWidth: 1, color: C.ink, fontSize: 16, minHeight: 52, paddingHorizontal: 14 }, fieldInputError: { borderColor: C.danger }, fieldError: { color: C.danger, fontSize: 12, marginTop: 6 }, formRow: { flexDirection: 'row', gap: 12 }, formHalf: { flex: 1 }, warning: { backgroundColor: C.goldSoft, borderRadius: 12, marginBottom: 20, padding: 14 }, warningTitle: { color: '#745322', fontSize: 13, fontWeight: '700' }, warningText: { color: '#806237', fontSize: 12, lineHeight: 18, marginTop: 4 }, preview: { alignItems: 'center', backgroundColor: C.greenSoft, borderRadius: 15, marginBottom: 22, padding: 18 }, previewLabel: { color: C.green, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, previewNumber: { color: C.greenDark, fontSize: 34, fontWeight: '800' }, previewText: { color: C.muted, fontSize: 12 },
});
