create table if not exists public.gauntlet_state (
  id smallint primary key check (id = 1),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.gauntlet_state enable row level security;

revoke all on public.gauntlet_state from public, anon, authenticated;
grant select on public.gauntlet_state to anon, authenticated;
grant update (state, updated_at) on public.gauntlet_state to authenticated;

drop policy if exists "Anyone can view the gauntlet" on public.gauntlet_state;
create policy "Anyone can view the gauntlet"
  on public.gauntlet_state
  for select
  to anon, authenticated
  using (true);

-- Replace the UUID below with your Supabase Auth user ID before running this policy.
drop policy if exists "Only the owner can update the gauntlet" on public.gauntlet_state;
create policy "Only the owner can update the gauntlet"
  on public.gauntlet_state
  for update
  to authenticated
  using (auth.uid() = 'Ov23libcoik4PrtUIauw'::uuid)
  with check (auth.uid() = 'Ov23libcoik4PrtUIauw'::uuid);

insert into public.gauntlet_state (id, state)
values (
  1,
  '{"teams":{"bonzo":[],"caboose":[]},"winners":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]}'::jsonb
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gauntlet_state'
  ) then
    alter publication supabase_realtime add table public.gauntlet_state;
  end if;
end
$$;
