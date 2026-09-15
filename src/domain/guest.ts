export type Guest = {
  id: string;
  name: string;
  companions: number;
  table: string;
  createdAt: string;
  updatedAt: string;
};

export type GuestDraft = Pick<Guest, 'name' | 'companions' | 'table'>;
export type GuestValidationErrors = Partial<Record<keyof GuestDraft, string>>;

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export function cleanGuestDraft(draft: GuestDraft): GuestDraft {
  return { name: draft.name.trim().replace(/\s+/g, ' '), companions: draft.companions, table: draft.table.trim().replace(/\s+/g, ' ') };
}

export function validateGuestDraft(draft: GuestDraft): GuestValidationErrors {
  const errors: GuestValidationErrors = {};
  if (!draft.name.trim()) errors.name = 'Informe o nome do convidado.';
  if (draft.name.trim().length > 100) errors.name = 'Use no máximo 100 caracteres.';
  if (!Number.isInteger(draft.companions) || draft.companions < 0) errors.companions = 'Informe zero ou um número inteiro maior.';
  if (draft.companions > 99) errors.companions = 'Use no máximo 99 acompanhantes.';
  if (!draft.table.trim()) errors.table = 'Informe a mesa do convidado.';
  if (draft.table.trim().length > 30) errors.table = 'Use no máximo 30 caracteres.';
  return errors;
}

export function searchGuests(guests: Guest[], query: string): Guest[] {
  const normalizedQuery = normalizeText(query);
  const result = normalizedQuery ? guests.filter((guest) => normalizeText(guest.name).includes(normalizedQuery)) : guests;
  return [...result].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function findPossibleDuplicates(guests: Guest[], name: string, ignoredId?: string): Guest[] {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return [];
  return guests.filter((guest) => guest.id !== ignoredId && normalizeText(guest.name) === normalizedName);
}

export function groupSize(guest: Pick<Guest, 'companions'>): number {
  return guest.companions + 1;
}

export function createGuest(draft: GuestDraft): Guest {
  const now = new Date().toISOString();
  return { ...cleanGuestDraft(draft), id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, createdAt: now, updatedAt: now };
}
