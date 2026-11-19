-- First Response fixture review queue. Run once in Supabase SQL Editor.
-- No existing fixture rows are changed by this migration.
create table if not exists public.fixture_proposals (
  id bigint generated always as identity primary key,
  proposal_key text not null unique,
  proposal_type text not null check (proposal_type in ('possible_new_fixture','possible_reschedule','ambiguous_match')),
  league text not null,
  home_team text not null,
  away_team text not null,
  proposed_date date not null,
  proposed_time time not null,
  existing_fixture_id bigint,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_fixture_id bigint,
  constraint fixture_proposals_type_check check (proposal_type <> 'possible_new_fixture' or existing_fixture_id is null)
);
create index if not exists fixture_proposals_pending_idx on public.fixture_proposals (review_status, proposed_date);
alter table public.fixture_proposals enable row level security;
revoke all on public.fixture_proposals from anon, authenticated;
grant select on public.fixture_proposals to authenticated;
create policy "Admins can read proposals" on public.fixture_proposals for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
-- Service role stages proposals; authenticated users cannot write the queue directly.
create or replace function public.review_fixture_proposal(p_id bigint, p_decision text)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare p public.fixture_proposals%rowtype;
declare new_id bigint;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'Invalid decision'; end if;
  select * into p from public.fixture_proposals where id = p_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if p.review_status <> 'pending' then raise exception 'Already reviewed'; end if;
  if p_decision = 'approve' then
    if p.proposal_type <> 'possible_new_fixture' then
      raise exception 'Reschedules and ambiguous proposals require manual fixture review';
    end if;
    -- Avoid duplicates even if an admin manually created this fixture after staging.
    if exists (select 1 from public.fixtures f where
      lower(trim(f.home_team)) = lower(trim(p.home_team)) and
      lower(trim(f.away_team)) = lower(trim(p.away_team)) and
      f.match_date = p.proposed_date and f.match_time = p.proposed_time) then
      raise exception 'A matching fixture already exists; review manually';
    end if;
    insert into public.fixtures (home_team, away_team, match_date, match_time, status, attended, is_released)
    values (p.home_team, p.away_team, p.proposed_date, p.proposed_time, 'scheduled', false, false)
    returning id into new_id;
    update public.fixture_proposals set review_status='approved', reviewed_at=now(),
      reviewed_by=auth.uid(), created_fixture_id=new_id where id=p_id;
    return 'Approved: fixture created but not released';
  else
    update public.fixture_proposals set review_status='rejected', reviewed_at=now(),
      reviewed_by=auth.uid() where id=p_id;
    return 'Proposal rejected';
  end if;
end;
$$;
revoke all on function public.review_fixture_proposal(bigint,text) from public, anon;
grant execute on function public.review_fixture_proposal(bigint,text) to authenticated;
