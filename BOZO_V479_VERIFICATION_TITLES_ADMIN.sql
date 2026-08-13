-- BOZO v4.7.9 — verification, chess titles, BM, exact-name overrides
begin;

alter table public.profiles add column if not exists identity_verified boolean not null default false;
alter table public.profiles add column if not exists identity_verified_at timestamptz;
alter table public.profiles add column if not exists chess_title text;
alter table public.profiles add column if not exists bozo_title text;

create table if not exists public.bozo_title_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_title text not null check (requested_title in ('GM','IM','FM','CM','WGM','WIM','WFM','WCM','NM','WNM')),
  evidence_text text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.bozo_name_overrides (
  normalized_name text primary key,
  display_name text not null,
  reason text,
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.bozo_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id), target_user_id uuid references auth.users(id),
  action text not null, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bozo_title_verification_requests enable row level security;
alter table public.bozo_name_overrides enable row level security;
alter table public.bozo_admin_audit enable row level security;

drop policy if exists "users read own title requests" on public.bozo_title_verification_requests;
create policy "users read own title requests" on public.bozo_title_verification_requests for select to authenticated using (user_id=auth.uid());

create or replace function public.bozo_is_owner(uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.user_roles where user_id=uid and role='owner');
$$;

create or replace function public.submit_title_verification_request(requested_title text,evidence_text text)
returns void language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if requested_title not in ('GM','IM','FM','CM','WGM','WIM','WFM','WCM','NM','WNM') then raise exception 'Unsupported title'; end if;
 if length(btrim(evidence_text))<3 then raise exception 'Verification evidence is required'; end if;
 if exists(select 1 from public.bozo_title_verification_requests where user_id=auth.uid() and status='pending') then raise exception 'You already have a pending title request'; end if;
 insert into public.bozo_title_verification_requests(user_id,requested_title,evidence_text) values(auth.uid(),requested_title,left(btrim(evidence_text),300));
end $$;

create or replace function public.owner_list_verification_requests()
returns table(id uuid,user_id uuid,requested_title text,evidence_text text,created_at timestamptz,ign text,username text)
language sql security definer set search_path=public as $$
 select r.id,r.user_id,r.requested_title,r.evidence_text,r.created_at,p.ign,p.username from public.bozo_title_verification_requests r join public.profiles p on p.id=r.user_id where public.bozo_is_owner() and r.status='pending' order by r.created_at;
$$;

create or replace function public.owner_review_title_request(request_id uuid,approve boolean)
returns void language plpgsql security definer set search_path=public as $$ declare r public.bozo_title_verification_requests; begin
 if not public.bozo_is_owner() then raise exception 'Owner access required'; end if;
 select * into r from public.bozo_title_verification_requests where id=request_id and status='pending'; if not found then raise exception 'Pending request not found'; end if;
 update public.bozo_title_verification_requests set status=case when approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now() where id=request_id;
 if approve then update public.profiles set chess_title=r.requested_title where id=r.user_id; end if;
 insert into public.bozo_admin_audit(actor_id,target_user_id,action,details) values(auth.uid(),r.user_id,case when approve then 'title_approved' else 'title_rejected' end,jsonb_build_object('title',r.requested_title));
end $$;

create or replace function public.owner_set_identity_verified(target_username text,enabled boolean)
returns void language plpgsql security definer set search_path=public as $$ declare uid uuid; begin
 if not public.bozo_is_owner() then raise exception 'Owner access required'; end if;
 select id into uid from public.profiles where lower(username)=lower(target_username); if uid is null then raise exception 'User not found'; end if;
 update public.profiles set identity_verified=enabled,identity_verified_at=case when enabled then now() else null end where id=uid;
 insert into public.bozo_admin_audit(actor_id,target_user_id,action,details) values(auth.uid(),uid,'identity_verification',jsonb_build_object('enabled',enabled));
end $$;

create or replace function public.owner_set_bozo_title(target_username text,title_value text)
returns void language plpgsql security definer set search_path=public as $$ declare uid uuid; begin
 if not public.bozo_is_owner() then raise exception 'Owner access required'; end if;
 if title_value is not null and title_value not in ('BM') then raise exception 'Unsupported BOZO title'; end if;
 select id into uid from public.profiles where lower(username)=lower(target_username); if uid is null then raise exception 'User not found'; end if;
 update public.profiles set bozo_title=title_value where id=uid;
 insert into public.bozo_admin_audit(actor_id,target_user_id,action,details) values(auth.uid(),uid,'bozo_title_changed',jsonb_build_object('title',title_value));
end $$;

create or replace function public.owner_allow_exact_name(name_value text,reason_text text default '')
returns void language plpgsql security definer set search_path=public as $$ declare norm text; begin
 if not public.bozo_is_owner() then raise exception 'Owner access required'; end if;
 norm:=public.bozo_compact_name(name_value); if norm='' then raise exception 'Name required'; end if;
 insert into public.bozo_name_overrides(normalized_name,display_name,reason,approved_by) values(norm,btrim(name_value),left(reason_text,300),auth.uid()) on conflict(normalized_name) do update set display_name=excluded.display_name,reason=excluded.reason,approved_by=auth.uid(),created_at=now();
 insert into public.bozo_admin_audit(actor_id,action,details) values(auth.uid(),'name_override_added',jsonb_build_object('name',name_value,'reason',reason_text));
end $$;

-- Replace enforcement trigger so exact owner-approved names bypass the filter, not the 20-char limit.
create or replace function public.enforce_bozo_profile_names() returns trigger language plpgsql as $$ declare ign_ok boolean; user_ok boolean; begin
 ign_ok := exists(select 1 from public.bozo_name_overrides where normalized_name=public.bozo_compact_name(new.ign));
 user_ok := exists(select 1 from public.bozo_name_overrides where normalized_name=public.bozo_compact_name(new.username));
 if char_length(btrim(coalesce(new.ign,'')))<1 or char_length(btrim(new.ign))>20 or (not ign_ok and not public.bozo_name_allowed(new.ign)) then raise exception 'That IGN is not allowed on BOZO.'; end if;
 if char_length(btrim(coalesce(new.username,'')))<3 or char_length(btrim(new.username))>20 or new.username !~ '^[A-Za-z0-9_]+$' or (not user_ok and not public.bozo_name_allowed(new.username)) then raise exception 'That username is not allowed on BOZO.'; end if;
 return new; end $$;

create or replace function public.owner_force_rename(target_username text,new_username text,reason_text text default '')
returns void language plpgsql security definer set search_path=public as $$ declare uid uuid; old_name text; begin
 if not public.bozo_is_owner() then raise exception 'Owner access required'; end if;
 select id,username into uid,old_name from public.profiles where lower(username)=lower(target_username); if uid is null then raise exception 'User not found'; end if;
 update public.profiles set username=btrim(new_username) where id=uid;
 insert into public.bozo_admin_audit(actor_id,target_user_id,action,details) values(auth.uid(),uid,'forced_rename',jsonb_build_object('old',old_name,'new',new_username,'reason',reason_text));
end $$;

grant execute on function public.submit_title_verification_request(text,text) to authenticated;
grant execute on function public.owner_list_verification_requests() to authenticated;
grant execute on function public.owner_review_title_request(uuid,boolean) to authenticated;
grant execute on function public.owner_set_identity_verified(text,boolean) to authenticated;
grant execute on function public.owner_set_bozo_title(text,text) to authenticated;
grant execute on function public.owner_allow_exact_name(text,text) to authenticated;
grant execute on function public.owner_force_rename(text,text,text) to authenticated;
commit;
