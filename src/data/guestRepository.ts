import AsyncStorage from '@react-native-async-storage/async-storage';
import { Guest } from '../domain/guest';

const STORAGE_KEY = '@recepcao-jantar/guests/v1';

function isGuest(value: unknown): value is Guest {
  if (!value || typeof value !== 'object') return false;
  const guest = value as Partial<Guest>;
  return typeof guest.id === 'string' && typeof guest.name === 'string' && Number.isInteger(guest.companions) && (guest.companions ?? -1) >= 0 && typeof guest.table === 'string' && typeof guest.createdAt === 'string' && typeof guest.updatedAt === 'string';
}

export interface GuestRepository {
  load(): Promise<Guest[]>;
  save(guests: Guest[]): Promise<void>;
}

export const localGuestRepository: GuestRepository = {
  async load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isGuest)) throw new Error('A lista salva neste aparelho está em um formato inválido.');
    return parsed;
  },
  async save(guests) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
  },
};
