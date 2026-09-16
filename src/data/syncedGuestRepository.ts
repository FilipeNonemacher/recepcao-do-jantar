import { Guest } from '../domain/guest';
import { supabase } from './supabase';

type GuestRow = {
  id: string;
  name: string;
  guest_role?: string;
  companions: number;
  table_name: string;
  checked_in?: boolean;
  created_at: string;
  updated_at: string;
};

function requireClient() {
  if (!supabase) throw new Error('A sincronização ainda não foi configurada.');
  return supabase;
}

function fromRow(row: GuestRow): Guest {
  return {
    id: row.id,
    name: row.name,
    role: row.guest_role?.trim() || 'Convidado',
    companions: row.companions,
    table: row.table_name,
    checkedIn: row.checked_in === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(guest: Guest): GuestRow {
  return {
    id: guest.id,
    name: guest.name,
    guest_role: guest.role,
    companions: guest.companions,
    table_name: guest.table,
    checked_in: guest.checkedIn,
    created_at: guest.createdAt,
    updated_at: guest.updatedAt,
  };
}

export async function loadSyncedGuests(): Promise<Guest[]> {
  const { data, error } = await requireClient().from('guests').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data as GuestRow[]).map(fromRow);
}

export async function saveSyncedGuest(guest: Guest): Promise<void> {
  const { error } = await requireClient().from('guests').upsert(toRow(guest));
  if (error) throw new Error(error.message);
}

export async function deleteSyncedGuest(id: string): Promise<void> {
  const { data, error } = await requireClient().from('guests').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('O convidado não foi encontrado ou não pôde ser excluído.');
}

export function subscribeToGuests(onChange: () => void, onStatus: (online: boolean) => void): () => void {
  const client = requireClient();
  const channel = client
    .channel('guests-reception')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, onChange)
    .subscribe((status) => onStatus(status === 'SUBSCRIBED'));

  return () => {
    void client.removeChannel(channel);
  };
}
