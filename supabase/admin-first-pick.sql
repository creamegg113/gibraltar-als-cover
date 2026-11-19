-- Run in Supabase SQL Editor before merging the admin-first-pick UI.
-- Assign a pending Gibraltar FA proposal or existing unreleased fixture to the signed-in admin.
create or replace function public.admin_claim_first_pick(p_proposal_id bigint default null,p_fixture_id bigint default null)
returns bigint
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_staff_id bigint; v_fixture_id bigint; p public.fixture_proposals%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then
    raise exception 'Administrator access required';
  end if;
  if (p_proposal_id is null)=(p_fixture_id is null) then
    raise exception 'Select exactly one match';
  end if;
  select id into v_staff_id from public.first_aiders where user_id=auth.uid() and approved=true;
  if v_staff_id is null then
    raise exception 'Your administrator account must also be linked to an approved first aider profile';
  end if;
  perform pg_advisory_xact_lock(71320591);
  if p_fixture_id is not null then
    update public.fixtures set assigned_staff_id=v_staff_id,attended=false
      where id=p_fixture_id and status='scheduled' and is_released=false and assigned_staff_id is null
      returning id into v_fixture_id;
    if v_fixture_id is null then raise exception 'Match no longer available for first pick'; end if;
  else
    select * into p from public.fixture_proposals where id=p_proposal_id for update;
    if not found or p.review_status<>'pending' or p.proposal_type<>'possible_new_fixture' then
      raise exception 'Fixture proposal no longer available';
    end if;
    if p.last_seen_at<now()-interval '24 hours' then
      raise exception 'Fixture information is outdated; run the monitor before claiming';
    end if;
    if exists(select 1 from public.fixtures f
      where lower(regexp_replace(f.home_team,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(p.home_team,'[^a-zA-Z0-9]','','g'))
      and lower(regexp_replace(f.away_team,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(p.away_team,'[^a-zA-Z0-9]','','g'))
      and f.match_date=p.proposed_date) then
      raise exception 'This match may already exist; review before claiming';
    end if;
    insert into public.fixtures(home_team,away_team,match_date,match_time,status,attended,is_released,assigned_staff_id)
      values(p.home_team,p.away_team,p.proposed_date,p.proposed_time,'scheduled',false,false,v_staff_id)
      returning id into v_fixture_id;
    update public.fixture_proposals set review_status='approved',reviewed_at=now(),
      reviewed_by=auth.uid(),created_fixture_id=v_fixture_id where id=p.id;
  end if;
  return v_fixture_id;
end;
$$;
revoke all on function public.admin_claim_first_pick(bigint,bigint) from public,anon;
grant execute on function public.admin_claim_first_pick(bigint,bigint) to authenticated;
