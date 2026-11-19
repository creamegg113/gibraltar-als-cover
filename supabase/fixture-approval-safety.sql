-- Apply after fixture-approval.sql. Does not alter existing fixture or assignment rows.
-- An approval must have been observed in a recent successful fixture-monitor run.
create or replace function public.review_fixture_proposal(p_id bigint, p_decision text)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  p public.fixture_proposals%rowtype;
  new_id bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'Invalid decision';
  end if;
  select * into p from public.fixture_proposals where id = p_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if p.review_status <> 'pending' then raise exception 'Already reviewed'; end if;
  if p_decision = 'reject' then
    update public.fixture_proposals
      set review_status='rejected', reviewed_at=now(), reviewed_by=auth.uid()
      where id=p_id;
    return 'Proposal rejected';
  end if;
  if p.proposal_type <> 'possible_new_fixture' then
    raise exception 'This proposal requires manual fixture review';
  end if;
  -- Fail closed if the monitor is not running or the match is no longer observed.
  if p.last_seen_at < now() - interval '24 hours' then
    raise exception 'Proposal is outdated. Refresh the Gibraltar FA monitor before approving';
  end if;
  -- Serialise approvals to avoid two concurrent admins inserting the same match.
  perform pg_advisory_xact_lock(hashtextextended(
    lower(regexp_replace(p.home_team,'[^a-zA-Z0-9]','','g')) || '|' ||
    lower(regexp_replace(p.away_team,'[^a-zA-Z0-9]','','g')) || '|' ||
    p.proposed_date::text, 0));
  if exists (
    select 1 from public.fixtures f
    where lower(regexp_replace(f.home_team,'[^a-zA-Z0-9]','','g')) =
          lower(regexp_replace(p.home_team,'[^a-zA-Z0-9]','','g'))
      and lower(regexp_replace(f.away_team,'[^a-zA-Z0-9]','','g')) =
          lower(regexp_replace(p.away_team,'[^a-zA-Z0-9]','','g'))
      and f.match_date = p.proposed_date
  ) then
    raise exception 'A fixture for these teams already exists on this date. Review manually';
  end if;
  insert into public.fixtures
    (home_team,away_team,match_date,match_time,status,attended,is_released)
    values (p.home_team,p.away_team,p.proposed_date,p.proposed_time,'scheduled',false,false)
    returning id into new_id;
  update public.fixture_proposals
    set review_status='approved',reviewed_at=now(),reviewed_by=auth.uid(),
        created_fixture_id=new_id
    where id=p_id;
  return 'Approved: fixture created but not released';
end;
$$;
revoke all on function public.review_fixture_proposal(bigint,text) from public, anon;
grant execute on function public.review_fixture_proposal(bigint,text) to authenticated;
