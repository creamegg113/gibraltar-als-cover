-- Apply in Supabase SQL Editor BEFORE merging the matching web interface.
-- Atomically select and release existing/new fixtures. Never modify assigned fixtures.
create or replace function public.release_selected_matches(p_proposal_ids bigint[], p_fixture_ids bigint[])
returns integer
language plpgsql security definer set search_path=public,pg_temp
as $$
declare p public.fixture_proposals%rowtype; fid bigint; released_count integer := 0;
begin
  if auth.uid() is null or not exists(select 1 from public.admin_users a where a.user_id=auth.uid()) then
    raise exception 'Administrator access required';
  end if;
  if coalesce(array_length(p_proposal_ids,1),0)+coalesce(array_length(p_fixture_ids,1),0)=0 then
    raise exception 'Select at least one match';
  end if;
  if coalesce(array_length(p_proposal_ids,1),0)+coalesce(array_length(p_fixture_ids,1),0)>100 then
    raise exception 'Select no more than 100 matches at once';
  end if;
  -- Serialize batches, including concurrent administrators.
  perform pg_advisory_xact_lock(71320591);
  for fid in select distinct unnest(coalesce(p_fixture_ids,array[]::bigint[])) order by 1 loop
    update public.fixtures set is_released=true
    where id=fid and status='scheduled' and is_released=false and assigned_staff_id is null;
    if not found then raise exception 'Fixture % cannot be released; refresh and check its status',fid; end if;
    released_count:=released_count+1;
  end loop;
  for p in select * from public.fixture_proposals
    where id=any(coalesce(p_proposal_ids,array[]::bigint[])) order by id for update
  loop
    if p.review_status<>'pending' or p.proposal_type<>'possible_new_fixture' then
      raise exception 'Proposal % is not available for release',p.id;
    end if;
    if p.last_seen_at<now()-interval '24 hours' then
      raise exception 'Proposal % is outdated; run the fixture monitor again',p.id;
    end if;
    if exists(select 1 from public.fixtures f
      where lower(regexp_replace(f.home_team,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(p.home_team,'[^a-zA-Z0-9]','','g'))
        and lower(regexp_replace(f.away_team,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(p.away_team,'[^a-zA-Z0-9]','','g'))
        and f.match_date=p.proposed_date) then
      raise exception 'A matching fixture already exists for proposal %; review manually',p.id;
    end if;
    insert into public.fixtures(home_team,away_team,match_date,match_time,status,attended,is_released)
      values(p.home_team,p.away_team,p.proposed_date,p.proposed_time,'scheduled',false,true)
      returning id into fid;
    update public.fixture_proposals set review_status='approved',reviewed_at=now(),
      reviewed_by=auth.uid(),created_fixture_id=fid where id=p.id;
    released_count:=released_count+1;
  end loop;
  if (select count(distinct x) from unnest(coalesce(p_proposal_ids,array[]::bigint[])) x)
     <> (select count(*) from public.fixture_proposals where id=any(coalesce(p_proposal_ids,array[]::bigint[])) and review_status='approved') then
    raise exception 'One or more proposals were unavailable; nothing was released';
  end if;
  return released_count;
end;
$$;
revoke all on function public.release_selected_matches(bigint[],bigint[]) from public,anon;
grant execute on function public.release_selected_matches(bigint[],bigint[]) to authenticated;
