import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultLayout, EventLayout, MapElement, normalizeLayout } from '../domain/eventLayout';

const STORAGE_KEY = '@recepcao-jantar/layout/v1';

function isElement(value: unknown): value is MapElement {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MapElement>;
  return typeof item.id === 'string' && (item.kind === 'table' || item.kind === 'structure') && typeof item.label === 'string' && typeof item.x === 'number' && typeof item.y === 'number' && typeof item.width === 'number' && typeof item.height === 'number' && typeof item.color === 'string' && (item.shape === 'circle' || item.shape === 'rectangle');
}

export const localLayoutRepository = {
  async load(): Promise<EventLayout> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultLayout();
    const parsed = JSON.parse(raw) as Partial<EventLayout>;
    if (!Array.isArray(parsed.elements) || !parsed.elements.every(isElement)) return createDefaultLayout();
    return normalizeLayout({ elements: parsed.elements, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(), locked: parsed.locked === true });
  },
  async save(layout: EventLayout): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  },
};
