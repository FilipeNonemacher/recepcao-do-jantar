begin;

create table if not exists public.guests (
  id text primary key,
  name text not null check (char_length(trim(name)) between 1 and 100),
  guest_role text not null default 'Convidado' check (char_length(trim(guest_role)) between 1 and 60),
  companions smallint not null default 0 check (companions between 0 and 99),
  table_name text not null check (char_length(trim(table_name)) between 1 and 30),
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_layouts (
  id text primary key,
  elements jsonb not null default '[]'::jsonb,
  is_locked boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.event_layouts
  add column if not exists is_locked boolean not null default false;

alter table public.guests
  add column if not exists guest_role text not null default 'Convidado';

alter table public.guests
  add column if not exists checked_in boolean not null default false;

do $$
begin
  alter table public.guests
    add constraint guests_guest_role_length
    check (char_length(trim(guest_role)) between 1 and 60);
exception
  when duplicate_object then null;
end $$;

alter table public.guests enable row level security;
alter table public.event_layouts enable row level security;

revoke all on table public.guests from anon;
grant select, insert, update, delete on table public.guests to authenticated;
revoke all on table public.event_layouts from anon;
grant select, insert, update, delete on table public.event_layouts to authenticated;

drop policy if exists "Equipe pode consultar convidados" on public.guests;
create policy "Equipe pode consultar convidados"
  on public.guests for select to authenticated using (true);

drop policy if exists "Equipe pode cadastrar convidados" on public.guests;
create policy "Equipe pode cadastrar convidados"
  on public.guests for insert to authenticated with check (true);

drop policy if exists "Equipe pode editar convidados" on public.guests;
create policy "Equipe pode editar convidados"
  on public.guests for update to authenticated using (true) with check (true);

drop policy if exists "Equipe pode excluir convidados" on public.guests;
create policy "Equipe pode excluir convidados"
  on public.guests for delete to authenticated using (true);

drop policy if exists "Equipe pode consultar o mapa" on public.event_layouts;
create policy "Equipe pode consultar o mapa"
  on public.event_layouts for select to authenticated using (true);

drop policy if exists "Equipe pode criar o mapa" on public.event_layouts;
create policy "Equipe pode criar o mapa"
  on public.event_layouts for insert to authenticated with check (true);

drop policy if exists "Equipe pode editar o mapa" on public.event_layouts;
create policy "Equipe pode editar o mapa"
  on public.event_layouts for update to authenticated using (true) with check (true);

drop policy if exists "Equipe pode excluir o mapa" on public.event_layouts;
create policy "Equipe pode excluir o mapa"
  on public.event_layouts for delete to authenticated using (true);

create or replace function public.protect_locked_event_layout()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.is_locked and new.elements is distinct from old.elements then
    raise exception 'O mapa está selado. Desbloqueie a edição antes de alterá-lo.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_locked_event_layout_trigger on public.event_layouts;
create trigger protect_locked_event_layout_trigger
  before update on public.event_layouts
  for each row execute function public.protect_locked_event_layout();

do $$
begin
  alter publication supabase_realtime add table public.guests;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.event_layouts;
exception
  when duplicate_object then null;
end $$;

commit;
