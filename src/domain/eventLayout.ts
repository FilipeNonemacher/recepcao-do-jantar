export type MapElementKind = 'table' | 'structure';
export type MapElementShape = 'circle' | 'rectangle';

export type MapElement = {
  id: string;
  kind: MapElementKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  shape: MapElementShape;
  capacity: number;
};

export type EventLayout = {
  elements: MapElement[];
  updatedAt: string;
  locked: boolean;
};

const table = (label: string, x: number, y: number, color = '#FFFFFF'): MapElement => ({
  id: `table-${label}`,
  kind: 'table',
  label,
  x,
  y,
  width: 8.5,
  height: 6.2,
  color,
  shape: 'circle',
  capacity: 8,
});

const structure = (id: string, label: string, x: number, y: number, width: number, height: number, color = '#F4F1E8'): MapElement => ({
  id,
  kind: 'structure',
  label,
  x,
  y,
  width,
  height,
  color,
  shape: 'rectangle',
  capacity: 0,
});

export function createDefaultLayout(): EventLayout {
  const white = '#FFFFFF';
  const yellow = '#FFE400';
  const red = '#F51D2A';
  return {
    updatedAt: new Date().toISOString(),
    locked: false,
    elements: [
      structure('stage', 'PALCO', 29, 7, 42, 8),
      structure('screen', 'TELÃO', 75, 8, 20, 7),
      structure('projector', 'MESA PROJETOR', 76, 19, 14, 7, '#D8DEE3'),
      structure('corridor', 'CORREDOR', 57, 66, 8, 25, '#EEF0EC'),
      structure('bar', 'COPA', 4, 92, 60, 7),
      structure('entrance', 'ENTRADA', 66, 92, 30, 7),
      table('21', 6, 40, white), table('22', 18, 40, white),
      table('20', 6, 49, white), table('15', 18, 49, yellow),
      table('19', 6, 58, white), table('14', 18, 58, yellow),
      table('18', 6, 67, white), table('7', 20, 67, red), table('2', 31, 67, red), table('1', 42, 67, red),
      table('17', 6, 76, white), table('8', 20, 76, red), table('4', 31, 76, red), table('3', 42, 76, red),
      table('16', 6, 85, white), table('9', 20, 85, white), table('6', 31, 85, red), table('5', 42, 85, red),
      table('29', 74, 40, white), table('30', 86, 40, white),
      table('27', 74, 49, white), table('28', 86, 49, white),
      table('25', 74, 58, white), table('26', 86, 58, white),
      table('23', 74, 67, white), table('24', 86, 67, white),
      table('10', 74, 76, red), table('11', 86, 76, white),
      table('12', 74, 85, white), table('13', 86, 85, white),
    ],
  };
}

export function findTableElement(layout: EventLayout, tableLabel: string): MapElement | undefined {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  const target = normalize(tableLabel);
  return layout.elements.find((element) => element.kind === 'table' && normalize(element.label) === target);
}

export function clampMapElement(element: MapElement): MapElement {
  const width = Math.max(5, Math.min(95, element.width));
  const height = Math.max(4, Math.min(95, element.height));
  return {
    ...element,
    width,
    height,
    x: Math.max(0, Math.min(100 - width, element.x)),
    y: Math.max(0, Math.min(100 - height, element.y)),
    capacity: element.kind === 'table' ? Math.max(1, Math.min(30, Math.round(element.capacity || 8))) : 0,
  };
}

export function createMapElement(kind: MapElementKind, existing: MapElement[]): MapElement {
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (kind === 'table') {
    const numbers = existing.filter((item) => item.kind === 'table').map((item) => Number(item.label)).filter(Number.isFinite);
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    return { id, kind, label: String(nextNumber), x: 45, y: 45, width: 8.5, height: 6.2, color: '#FFFFFF', shape: 'circle', capacity: 8 };
  }
  return { id, kind, label: 'NOVO ITEM', x: 40, y: 30, width: 20, height: 7, color: '#F4F1E8', shape: 'rectangle', capacity: 0 };
}

export function normalizeLayout(layout: EventLayout): EventLayout {
  return { ...layout, locked: layout.locked === true, elements: layout.elements.map((element) => clampMapElement({ ...element, capacity: element.kind === 'table' ? element.capacity || 8 : 0 })) };
}
