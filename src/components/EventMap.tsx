import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Modal, PanResponder, Pressable, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { clampMapElement, createMapElement, EventLayout, findTableElement, MapElement } from '../domain/eventLayout';
import { Guest, groupSize, normalizeText } from '../domain/guest';

const COLORS = ['#FFFFFF', '#F51D2A', '#FFE400', '#245744', '#4D76B8', '#D8DEE3', '#F4F1E8'];
const INK = '#17211B';
const GREEN = '#245744';
const GOLD = '#C29148';

type EventMapProps = {
  layout: EventLayout;
  editable?: boolean;
  selectedId?: string;
  highlightedTable?: string;
  onSelect?: (id: string) => void;
  onMove?: (element: MapElement) => void;
  onDragStateChange?: (dragging: boolean) => void;
  occupancy?: Record<string, number>;
};

export function EventMap({ layout, editable = false, selectedId, highlightedTable, onSelect, onMove, onDragStateChange, occupancy }: EventMapProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const highlightedId = highlightedTable ? findTableElement(layout, highlightedTable)?.id : undefined;
  return (
    <View
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      style={styles.map}
    >
      <View style={styles.mapTitle}><Text style={styles.mapTitleText}>MAPA DO JANTAR</Text></View>
      {layout.elements.map((element) => (
        <MapItem
          key={element.id}
          element={element}
          editable={editable}
          highlighted={element.id === highlightedId}
          selected={element.id === selectedId}
          mapSize={size}
          onMove={onMove}
          onSelect={onSelect}
          onDragStateChange={onDragStateChange}
          occupiedSeats={occupancy?.[normalizeText(element.label)]}
        />
      ))}
    </View>
  );
}

function MapItem({ element, editable, highlighted, selected, mapSize, onMove, onSelect, onDragStateChange, occupiedSeats }: {
  element: MapElement;
  editable: boolean;
  highlighted: boolean;
  selected: boolean;
  mapSize: { width: number; height: number };
  onMove?: (element: MapElement) => void;
  onSelect?: (id: string) => void;
  onDragStateChange?: (dragging: boolean) => void;
  occupiedSeats?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const elementRef = useRef(element);
  const sizeRef = useRef(mapSize);
  const moveRef = useRef(onMove);
  const selectRef = useRef(onSelect);
  const dragStateRef = useRef(onDragStateChange);
  const start = useRef({ x: element.x, y: element.y });
  elementRef.current = element;
  sizeRef.current = mapSize;
  moveRef.current = onMove;
  selectRef.current = onSelect;
  dragStateRef.current = onDragStateChange;

  useEffect(() => {
    if (!highlighted) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 520, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [highlighted, pulse]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => editable,
    onStartShouldSetPanResponderCapture: () => editable,
    onMoveShouldSetPanResponder: (_event, gesture) => editable && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => editable && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
    onPanResponderGrant: () => { start.current = { x: elementRef.current.x, y: elementRef.current.y }; dragStateRef.current?.(true); },
    onPanResponderMove: (_event, gesture) => {
      const current = elementRef.current;
      const width = Math.max(1, sizeRef.current.width);
      const height = Math.max(1, sizeRef.current.height);
      moveRef.current?.(clampMapElement({ ...current, x: start.current.x + (gesture.dx / width) * 100, y: start.current.y + (gesture.dy / height) * 100 }));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) selectRef.current?.(elementRef.current.id);
      dragStateRef.current?.(false);
    },
    onPanResponderTerminate: () => dragStateRef.current?.(false),
    onPanResponderTerminationRequest: () => false,
  }), [editable]);

  const isTable = element.kind === 'table';
  const textColor = darkTextFor(element.color) ? INK : '#FFFFFF';
  const position = {
    left: `${element.x}%` as `${number}%`,
    top: `${element.y}%` as `${number}%`,
    width: `${element.width}%` as `${number}%`,
    height: `${element.height}%` as `${number}%`,
  };
  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.item,
        position,
        { backgroundColor: element.color },
        isTable ? styles.table : styles.structure,
        selected && styles.selected,
        editable && styles.editable,
      ]}
    >
      {highlighted && <Animated.View pointerEvents="none" style={[styles.highlight, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }] }]} />}
      {isTable && occupiedSeats !== undefined && <ChairRing capacity={element.capacity || 8} occupied={occupiedSeats} />}
      <Text adjustsFontSizeToFit minimumFontScale={0.45} numberOfLines={isTable ? 1 : 2} style={[isTable ? styles.tableText : styles.structureText, { color: textColor }]}>{element.label}</Text>
      {isTable && occupiedSeats !== undefined && <Text style={[styles.occupancyText, { color: textColor }]}>{occupiedSeats}/{element.capacity || 8}</Text>}
    </View>
  );
}

function ChairRing({ capacity, occupied }: { capacity: number; occupied: number }) {
  const seats = Array.from({ length: capacity }, (_, index) => {
    const angle = (Math.PI * 2 * index) / capacity - Math.PI / 2;
    return { left: `${50 + Math.cos(angle) * 67}%` as `${number}%`, top: `${50 + Math.sin(angle) * 67}%` as `${number}%` };
  });
  return <View pointerEvents="none" style={styles.chairRing}>{seats.map((position, index) => <View key={index} style={[styles.chair, position, index < occupied && styles.chairOccupied]} />)}</View>;
}

function darkTextFor(color: string): boolean {
  const value = color.replace('#', '');
  if (value.length !== 6) return true;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function LayoutEditorScreen({ layout, onSave }: { layout: EventLayout; onSave: (layout: EventLayout) => Promise<void> }) {
  const [draft, setDraft] = useState(layout);
  const [selectedId, setSelectedId] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState('Arraste os itens para mudar suas posições.');
  useEffect(() => { setDraft(layout); if (layout.locked) setSelectedId(undefined); }, [layout.updatedAt]);
  const selected = draft.elements.find((element) => element.id === selectedId);
  const replace = (element: MapElement) => { if (!draft.locked) setDraft((current) => ({ ...current, elements: current.elements.map((item) => item.id === element.id ? clampMapElement(element) : item) })); };
  const add = (kind: 'table' | 'structure') => {
    if (draft.locked) return;
    const element = createMapElement(kind, draft.elements);
    setDraft((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
    setMessage(kind === 'table' ? 'Nova mesa adicionada. Edite o número e arraste-a.' : 'Novo item adicionado. Edite o nome, tamanho e posição.');
  };
  const remove = () => {
    if (!selected || draft.locked) return;
    setDraft((current) => ({ ...current, elements: current.elements.filter((item) => item.id !== selected.id) }));
    setSelectedId(undefined);
    setMessage('Item removido. Salve para confirmar a alteração.');
  };
  const save = async () => {
    if (draft.locked) return;
    setSaving(true);
    try {
      await onSave({ ...draft, updatedAt: new Date().toISOString() });
      setMessage('Mapa salvo e sincronizado.');
    } catch {
      setMessage('Não foi possível salvar. Confira a conexão e tente novamente.');
    } finally { setSaving(false); }
  };
  const changeLock = async (locked: boolean) => {
    setSaving(true);
    const next = { ...draft, locked, updatedAt: new Date().toISOString() };
    try {
      await onSave(next);
      setDraft(next);
      setSelectedId(undefined);
      setSettingsOpen(false);
      setMessage(locked ? 'Mapa selado. A configuração está protegida para todos.' : 'Mapa desbloqueado. As edições estão liberadas novamente.');
    } catch {
      setMessage('Não foi possível alterar o bloqueio. Confira a conexão e tente novamente.');
    } finally { setSaving(false); }
  };
  return (
    <ScrollView contentContainerStyle={styles.editorContent} scrollEnabled={!dragging}>
      <View style={styles.headingRow}><View style={styles.headingBlock}><Text style={styles.heading}>Mapa do jantar</Text><Text style={styles.subheading}>{draft.locked ? 'Mapa oficial do evento, protegido contra alterações.' : 'Edite a planta e arraste cada item até a posição desejada.'}</Text></View><Pressable accessibilityLabel="Opções do mapa" onPress={() => setSettingsOpen((open) => !open)} style={styles.moreButton}><Text style={styles.moreText}>•••</Text></Pressable></View>
      {settingsOpen && <View style={styles.settingsPanel}><Text style={styles.settingsTitle}>Controle do mapa</Text><Text style={styles.settingsText}>{draft.locked ? 'Para fazer alterações, desbloqueie a edição. O mapa ficará editável para todos os aparelhos conectados.' : 'Ao selar, esta configuração será salva como o mapa oficial e ninguém poderá mover, adicionar ou excluir itens até o desbloqueio.'}</Text><Action label={saving ? 'Aguarde…' : draft.locked ? 'Desbloquear edição' : 'Selar e definir mapa'} onPress={() => void changeLock(!draft.locked)} disabled={saving} /></View>}
      <View style={[styles.lockBanner, draft.locked ? styles.lockBannerOn : styles.lockBannerOff]}><Text style={[styles.lockText, draft.locked && styles.lockTextOn]}>{draft.locked ? '🔒 MAPA SELADO' : 'EDIÇÃO LIBERADA'}</Text></View>
      {!draft.locked && <View style={styles.toolbar}>
        <Action label="+ Mesa" onPress={() => add('table')} />
        <Action label="+ Estrutura" onPress={() => add('structure')} secondary />
        <Action label={saving ? 'Salvando…' : 'Salvar mapa'} onPress={() => void save()} disabled={saving} />
      </View>}
      <Text style={styles.helper}>{message}</Text>
      <EventMap layout={draft} editable={!draft.locked} selectedId={selectedId} onDragStateChange={setDragging} onMove={replace} onSelect={setSelectedId} />
      {selected && !draft.locked && <View style={styles.inspector}>
        <Text style={styles.inspectorTitle}>{selected.kind === 'table' ? 'Editar mesa' : 'Editar estrutura'}</Text>
        <Text style={styles.fieldLabel}>{selected.kind === 'table' ? 'Número ou identificação' : 'Nome do item'}</Text>
        <TextInput maxLength={60} onChangeText={(label) => replace({ ...selected, label })} style={styles.input} value={selected.label} />
        {selected.kind === 'table' && <><Text style={styles.fieldLabel}>Quantidade de lugares</Text><View style={styles.capacityRow}><Action label="−" onPress={() => replace({ ...selected, capacity: selected.capacity - 1 })} secondary compact /><Text style={styles.capacityNumber}>{selected.capacity}</Text><Action label="+" onPress={() => replace({ ...selected, capacity: selected.capacity + 1 })} secondary compact /></View></>}
        <Text style={styles.fieldLabel}>Cor</Text>
        <View style={styles.colors}>{COLORS.map((color) => <Pressable accessibilityLabel={`Usar cor ${color}`} key={color} onPress={() => replace({ ...selected, color })} style={[styles.color, { backgroundColor: color }, selected.color === color && styles.colorSelected]} />)}</View>
        <Text style={styles.fieldLabel}>Tamanho</Text>
        <View style={styles.sizeRow}>
          <Action label="− Largura" onPress={() => replace({ ...selected, width: selected.width - 2 })} secondary compact />
          <Action label="+ Largura" onPress={() => replace({ ...selected, width: selected.width + 2 })} secondary compact />
          <Action label="− Altura" onPress={() => replace({ ...selected, height: selected.height - 1.5 })} secondary compact />
          <Action label="+ Altura" onPress={() => replace({ ...selected, height: selected.height + 1.5 })} secondary compact />
        </View>
        <Pressable onPress={remove} style={styles.remove}><Text style={styles.removeText}>Excluir este item</Text></Pressable>
      </View>}
    </ScrollView>
  );
}

export function OccupancyScreen({ layout, guests }: { layout: EventLayout; guests: Guest[] }) {
  const occupancy = guests.reduce<Record<string, number>>((totals, guest) => {
    if (!guest.checkedIn) return totals;
    const key = normalizeText(guest.table);
    totals[key] = (totals[key] || 0) + groupSize(guest);
    return totals;
  }, {});
  const tables = layout.elements.filter((element) => element.kind === 'table');
  const capacity = tables.reduce((sum, table) => sum + (table.capacity || 8), 0);
  const present = Object.values(occupancy).reduce((sum, value) => sum + value, 0);
  const overCapacity = tables.filter((table) => (occupancy[normalizeText(table.label)] || 0) > (table.capacity || 8));
  return <ScrollView contentContainerStyle={styles.occupancyContent}>
    <Text style={styles.heading}>Ocupação das mesas</Text>
    <Text style={styles.subheading}>Vermelho indica lugar ocupado; branco indica lugar disponível.</Text>
    <View style={styles.occupancyStats}><View style={styles.occupancyStat}><Text style={styles.occupancyValue}>{present}</Text><Text style={styles.occupancyLabel}>presentes</Text></View><View style={styles.occupancyStat}><Text style={styles.occupancyValue}>{Math.max(0, capacity - present)}</Text><Text style={styles.occupancyLabel}>vagas</Text></View><View style={styles.occupancyStat}><Text style={styles.occupancyValue}>{capacity}</Text><Text style={styles.occupancyLabel}>lugares</Text></View></View>
    {!!overCapacity.length && <Text style={styles.warning}>Capacidade excedida: mesas {overCapacity.map((table) => table.label).join(', ')}.</Text>}
    <EventMap layout={layout} occupancy={occupancy} />
  </ScrollView>;
}

function Action({ label, onPress, secondary, compact, disabled }: { label: string; onPress: () => void; secondary?: boolean; compact?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.action, secondary && styles.actionSecondary, compact && styles.actionCompact, disabled && styles.disabled]}><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text></Pressable>;
}

export function MapViewerModal({ guest, layout, onClose }: { guest?: Guest; layout: EventLayout; onClose: () => void }) {
  const tableExists = guest ? Boolean(findTableElement(layout, guest.table)) : false;
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={Boolean(guest)}><SafeAreaView style={styles.modalPage}>
    <View style={styles.modalHeader}><Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>Fechar</Text></Pressable><Text style={styles.modalTitle}>Localização da mesa</Text><View style={styles.close} /></View>
    <ScrollView contentContainerStyle={styles.viewerContent}>
      {guest && <View style={styles.guestSummary}><Text style={styles.guestName}>{guest.name}</Text><Text style={styles.guestRole}>{guest.role}</Text><Text style={styles.guestTable}>Mesa {guest.table}</Text></View>}
      {!tableExists && guest && <Text style={styles.warning}>A mesa {guest.table} ainda não foi adicionada ao mapa.</Text>}
      <EventMap layout={layout} highlightedTable={guest?.table} />
      <Text style={styles.viewerHelp}>A mesa destacada está piscando no mapa.</Text>
    </ScrollView>
  </SafeAreaView></Modal>;
}

const styles = StyleSheet.create({
  map: { aspectRatio: 0.72, alignSelf: 'center', backgroundColor: '#FCFBF7', borderColor: '#D9DDD8', borderRadius: 16, borderWidth: 1, maxWidth: 700, overflow: 'hidden', position: 'relative', width: '100%' },
  mapTitle: { alignItems: 'center', left: '18%', position: 'absolute', right: '18%', top: '1.5%' }, mapTitleText: { color: INK, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  item: { alignItems: 'center', justifyContent: 'center', position: 'absolute' }, table: { borderColor: INK, borderRadius: 999, borderWidth: 2 }, structure: { borderColor: INK, borderRadius: 3, borderWidth: 1.5, padding: 2 }, editable: { elevation: 2 }, selected: { borderColor: GOLD, borderWidth: 3 },
  tableText: { fontSize: 15, fontWeight: '900', paddingHorizontal: 2, textAlign: 'center', width: '100%' }, structureText: { fontSize: 9, fontWeight: '900', textAlign: 'center', width: '100%' },
  occupancyText: { fontSize: 7, fontWeight: '800', marginTop: -2 }, chairRing: { bottom: 0, left: 0, overflow: 'visible', position: 'absolute', right: 0, top: 0 }, chair: { backgroundColor: '#FFFFFF', borderColor: '#A33D3D', borderRadius: 5, borderWidth: 1, height: 8, marginLeft: -4, marginTop: -4, position: 'absolute', width: 8 }, chairOccupied: { backgroundColor: '#E42D35' },
  highlight: { borderColor: '#00A8FF', borderRadius: 999, borderWidth: 4, bottom: -6, left: -6, position: 'absolute', right: -6, top: -6 },
  editorContent: { alignSelf: 'center', maxWidth: 760, paddingBottom: 34, paddingHorizontal: 18, paddingTop: 22, width: '100%' }, heading: { color: INK, fontSize: 27, fontWeight: '700' }, subheading: { color: '#647067', fontSize: 14, lineHeight: 20, marginTop: 5 }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 17 }, helper: { color: '#647067', fontSize: 12, marginBottom: 12, marginTop: 10 },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row' }, headingBlock: { flex: 1 }, moreButton: { alignItems: 'center', borderColor: '#DEE4DF', borderRadius: 10, borderWidth: 1, height: 40, justifyContent: 'center', marginLeft: 12, width: 44 }, moreText: { color: INK, fontSize: 17, fontWeight: '900', letterSpacing: 2, marginTop: -7 }, settingsPanel: { backgroundColor: '#FFFFFF', borderColor: '#DEE4DF', borderRadius: 13, borderWidth: 1, marginTop: 12, padding: 16 }, settingsTitle: { color: INK, fontSize: 15, fontWeight: '800' }, settingsText: { color: '#647067', fontSize: 12, lineHeight: 18, marginBottom: 13, marginTop: 6 }, lockBanner: { alignItems: 'center', borderRadius: 9, marginTop: 14, padding: 9 }, lockBannerOn: { backgroundColor: '#F7EEDC' }, lockBannerOff: { backgroundColor: '#E5EFE9' }, lockText: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, lockTextOn: { color: '#745322' },
  action: { alignItems: 'center', backgroundColor: GREEN, borderRadius: 10, justifyContent: 'center', minHeight: 43, paddingHorizontal: 15 }, actionSecondary: { backgroundColor: '#E5EFE9', borderColor: '#C9D8D0', borderWidth: 1 }, actionCompact: { minHeight: 38, paddingHorizontal: 10 }, actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }, actionTextSecondary: { color: GREEN }, disabled: { opacity: 0.5 },
  inspector: { backgroundColor: '#FFFFFF', borderColor: '#DEE4DF', borderRadius: 15, borderWidth: 1, marginTop: 16, padding: 18 }, inspectorTitle: { color: INK, fontSize: 18, fontWeight: '700', marginBottom: 14 }, fieldLabel: { color: INK, fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 10 }, input: { backgroundColor: '#FAF8F3', borderColor: '#DEE4DF', borderRadius: 10, borderWidth: 1, color: INK, fontSize: 16, minHeight: 47, paddingHorizontal: 12 }, colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, color: { borderColor: '#ADB5AF', borderRadius: 19, borderWidth: 1, height: 38, width: 38 }, colorSelected: { borderColor: GOLD, borderWidth: 4 }, sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, remove: { alignItems: 'center', backgroundColor: '#FCEAEA', borderRadius: 10, marginTop: 20, padding: 13 }, removeText: { color: '#A33D3D', fontSize: 13, fontWeight: '700' },
  capacityRow: { alignItems: 'center', flexDirection: 'row', gap: 14 }, capacityNumber: { color: INK, fontSize: 20, fontWeight: '800', minWidth: 32, textAlign: 'center' }, occupancyContent: { alignSelf: 'center', maxWidth: 760, paddingBottom: 34, paddingHorizontal: 18, paddingTop: 22, width: '100%' }, occupancyStats: { flexDirection: 'row', gap: 8, marginBottom: 18, marginTop: 15 }, occupancyStat: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DEE4DF', borderRadius: 12, borderWidth: 1, flex: 1, padding: 12 }, occupancyValue: { color: GREEN, fontSize: 22, fontWeight: '900' }, occupancyLabel: { color: '#647067', fontSize: 10, marginTop: 2 },
  modalPage: { backgroundColor: '#FAF8F3', flex: 1 }, modalHeader: { alignItems: 'center', borderBottomColor: '#DEE4DF', borderBottomWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: 18 }, close: { width: 70 }, closeText: { color: GREEN, fontSize: 14, fontWeight: '700' }, modalTitle: { color: INK, flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' }, viewerContent: { alignSelf: 'center', maxWidth: 760, padding: 18, width: '100%' }, guestSummary: { alignItems: 'center', marginBottom: 15 }, guestName: { color: INK, fontSize: 22, fontWeight: '800', textAlign: 'center' }, guestRole: { color: GOLD, fontSize: 13, fontWeight: '700', marginTop: 3 }, guestTable: { color: GREEN, fontSize: 18, fontWeight: '800', marginTop: 7 }, warning: { backgroundColor: '#F7EEDC', borderRadius: 10, color: '#745322', marginBottom: 12, padding: 12, textAlign: 'center' }, viewerHelp: { color: '#647067', fontSize: 12, marginTop: 10, textAlign: 'center' },
});
