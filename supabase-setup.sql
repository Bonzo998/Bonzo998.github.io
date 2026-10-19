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

-- Keep this UUID in sync with adminUserId in config.js.
drop policy if exists "Only the owner can update the gauntlet" on public.gauntlet_state;
create policy "Only the owner can update the gauntlet"
  on public.gauntlet_state
  for update
  to authenticated
  using (auth.uid() = '32111822-9144-41ee-a7a5-a4681f3338e8'::uuid)
  with check (auth.uid() = '32111822-9144-41ee-a7a5-a4681f3338e8'::uuid);

insert into public.gauntlet_state (id, state)
values (
  1,
  '{
    "teams": {"bonzo": [], "caboose": []},
    "winners": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    "matchData": {
      "6": {"rounds": [
        {"size": 2, "players": {"bonzo": [null, null], "caboose": [null, null]}, "winner": null},
        {"size": 2, "players": {"bonzo": [null, null], "caboose": [null, null]}, "winner": null},
        {"size": 1, "players": {"bonzo": [null], "caboose": [null]}, "winner": null}
      ]},
      "7": {"kingTeam": null, "kingPlayer": "", "queues": {"bonzo": [null, null, null, null, null], "caboose": [null, null, null, null, null]}, "winners": []},
      "9": {"rounds": [
        {"soloTeam": "bonzo", "soloPlayer": "", "opponents": [null, null, null, null], "durationSeconds": null},
        {"soloTeam": "caboose", "soloPlayer": "", "opponents": [null, null, null, null], "durationSeconds": null}
      ]},
      "14": {"rounds": [
        {"size": 2, "players": {"bonzo": [null, null], "caboose": [null, null]}, "winner": null},
        {"size": 2, "players": {"bonzo": [null, null], "caboose": [null, null]}, "winner": null},
        {"size": 1, "players": {"bonzo": [null], "caboose": [null]}, "winner": null}
      ]},
      "15": {"kingTeam": null, "kingPlayer": "", "queues": {"bonzo": [null, null, null, null, null], "caboose": [null, null, null, null, null]}, "winners": []}
    }
  }'::jsonb
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
