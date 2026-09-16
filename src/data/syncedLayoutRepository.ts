import { EventLayout, MapElement } from '../domain/eventLayout';
import { supabase } from './supabase';

type LayoutRow = { id: string; elements: MapElement[]; updated_at: string };

function requireClient() {
  if (!supabase) throw new Error('A sincronização ainda não foi configurada.');
  return supabase;
}

export async function loadSyncedLayout(): Promise<EventLayout | null> {
  const { data, error } = await requireClient().from('event_layouts').select('*').eq('id', 'main').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as LayoutRow;
  return { elements: row.elements, updatedAt: row.updated_at };
}

export async function saveSyncedLayout(layout: EventLayout): Promise<void> {
  const { error } = await requireClient().from('event_layouts').upsert({ id: 'main', elements: layout.elements, updated_at: layout.updatedAt });
  if (error) throw new Error(error.message);
}

export function subscribeToLayout(onChange: () => void): () => void {
  const client = requireClient();
  const channel = client.channel('event-layout-reception').on('postgres_changes', { event: '*', schema: 'public', table: 'event_layouts', filter: 'id=eq.main' }, onChange).subscribe();
  return () => { void client.removeChannel(channel); };
}
