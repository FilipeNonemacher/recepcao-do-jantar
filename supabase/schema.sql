begin;

create table if not exists public.guests (
  id text primary key,
  name text not null check (char_length(trim(name)) between 1 and 100),
  companions smallint not null default 0 check (companions between 0 and 99),
  table_name text not null check (char_length(trim(table_name)) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guests enable row level security;

revoke all on table public.guests from anon;
grant select, insert, update, delete on table public.guests to authenticated;

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

do $$
begin
  alter publication supabase_realtime add table public.guests;
exception
  when duplicate_object then null;
end $$;

commit;
