alter table public.openings
  add column if not exists recommended_min_elo integer,
  add column if not exists recommended_max_elo integer,
  add column if not exists elo_reviewed boolean not null default false,
  add column if not exists elo_updated_at timestamptz,
  add column if not exists elo_updated_by uuid references auth.users(id);

create or replace function public.owner_search_opening_elo(search_text text default '', row_limit integer default 100)
returns table(id text,eco text,name text,variation text,source_type text,status text,metadata jsonb,recommended_min_elo integer,recommended_max_elo integer,elo_reviewed boolean,elo_updated_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select o.id,o.eco,o.name,o.variation,o.source_type,o.status,o.metadata,o.recommended_min_elo,o.recommended_max_elo,o.elo_reviewed,o.elo_updated_at
  from public.openings o
  where private.has_any_role(array['owner'::public.app_role,'administrator'::public.app_role])
    and (coalesce(btrim(search_text),'')='' or o.name ilike '%'||btrim(search_text)||'%' or coalesce(o.variation,'') ilike '%'||btrim(search_text)||'%' or coalesce(o.eco,'') ilike '%'||btrim(search_text)||'%')
  order by o.eco nulls last,o.name,o.id limit greatest(1,least(coalesce(row_limit,100),250));
$$;

create or replace function public.owner_set_opening_elo(p_opening_id text,p_min_elo integer,p_max_elo integer,p_reviewed boolean default true)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare result jsonb;
begin
  if not private.has_any_role(array['owner'::public.app_role,'administrator'::public.app_role]) then raise exception 'Owner or Administrator role required'; end if;
  if p_min_elo is null or p_max_elo is null or p_min_elo<300 or p_max_elo>3000 or p_min_elo>p_max_elo then raise exception 'Use a valid Elo range from 300 to 3000.'; end if;
  update public.openings set recommended_min_elo=p_min_elo,recommended_max_elo=p_max_elo,elo_reviewed=coalesce(p_reviewed,true),elo_updated_at=now(),elo_updated_by=auth.uid(),updated_at=now() where id=p_opening_id
  returning jsonb_build_object('id',id,'recommended_min_elo',recommended_min_elo,'recommended_max_elo',recommended_max_elo,'elo_reviewed',elo_reviewed,'elo_updated_at',elo_updated_at) into result;
  if result is null then raise exception 'Opening not found.'; end if;
  insert into public.bozo_admin_audit(actor_id,action,details) values(auth.uid(),'opening_elo_updated',jsonb_build_object('opening_id',p_opening_id,'min',p_min_elo,'max',p_max_elo,'reviewed',coalesce(p_reviewed,true)));
  return result;
end; $$;

create or replace function public.owner_reset_opening_elo(p_opening_id text)
returns boolean language plpgsql security definer set search_path to '' as $$
begin
  if not private.has_any_role(array['owner'::public.app_role,'administrator'::public.app_role]) then raise exception 'Owner or Administrator role required'; end if;
  update public.openings set recommended_min_elo=null,recommended_max_elo=null,elo_reviewed=false,elo_updated_at=now(),elo_updated_by=auth.uid(),updated_at=now() where id=p_opening_id;
  if not found then raise exception 'Opening not found.'; end if;
  insert into public.bozo_admin_audit(actor_id,action,details) values(auth.uid(),'opening_elo_reset',jsonb_build_object('opening_id',p_opening_id)); return true;
end; $$;

grant execute on function public.owner_search_opening_elo(text,integer) to authenticated;
grant execute on function public.owner_set_opening_elo(text,integer,integer,boolean) to authenticated;
grant execute on function public.owner_reset_opening_elo(text) to authenticated;
