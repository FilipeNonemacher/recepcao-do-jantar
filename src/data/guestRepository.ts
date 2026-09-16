import AsyncStorage from '@react-native-async-storage/async-storage';
import { Guest } from '../domain/guest';

const STORAGE_KEY = '@recepcao-jantar/guests/v1';

function parseGuest(value: unknown): Guest | null {
  if (!value || typeof value !== 'object') return null;
  const guest = value as Partial<Guest>;
  const isValid = typeof guest.id === 'string' && typeof guest.name === 'string' && Number.isInteger(guest.companions) && (guest.companions ?? -1) >= 0 && typeof guest.table === 'string' && typeof guest.createdAt === 'string' && typeof guest.updatedAt === 'string';
  if (!isValid) return null;
  return { ...guest, role: typeof guest.role === 'string' && guest.role.trim() ? guest.role : 'Convidado', checkedIn: guest.checkedIn === true } as Guest;
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
    if (!Array.isArray(parsed)) throw new Error('A lista salva neste aparelho está em um formato inválido.');
    const guests = parsed.map(parseGuest);
    if (guests.some((guest) => !guest)) throw new Error('A lista salva neste aparelho está em um formato inválido.');
    return guests as Guest[];
  },
  async save(guests) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
  },
};
