-- BOZO v2.7.2 announcement management
-- Run once in the Supabase SQL Editor.

create or replace function public.owner_list_announcements()
returns table(
  id text,
  title text,
  body text,
  is_active boolean,
  is_pinned boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'owner'
  ) then
    raise exception 'Owner access required';
  end if;

  return query
  select a.id::text, a.title, a.body, a.is_active, a.is_pinned, a.created_at
  from public.announcements a
  order by a.is_pinned desc, a.created_at desc;
end;
$$;

create or replace function public.owner_update_announcement(
  announcement_id text,
  announcement_title text,
  announcement_body text,
  pin_announcement boolean,
  activate_announcement boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'owner'
  ) then
    raise exception 'Owner access required';
  end if;

  if length(trim(announcement_title)) = 0 or length(trim(announcement_title)) > 60 then
    raise exception 'Announcement title must be between 1 and 60 characters';
  end if;
  if length(trim(announcement_body)) = 0 or length(trim(announcement_body)) > 500 then
    raise exception 'Announcement message must be between 1 and 500 characters';
  end if;

  if pin_announcement then
    update public.announcements set is_pinned = false where id::text <> announcement_id;
  end if;

  update public.announcements
  set title = trim(announcement_title),
      body = trim(announcement_body),
      is_pinned = pin_announcement,
      is_active = activate_announcement
  where id::text = announcement_id;
end;
$$;

create or replace function public.owner_delete_announcement(announcement_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'owner'
  ) then
    raise exception 'Owner access required';
  end if;

  delete from public.announcements where id::text = announcement_id;
end;
$$;

grant execute on function public.owner_list_announcements() to authenticated;
grant execute on function public.owner_update_announcement(text,text,text,boolean,boolean) to authenticated;
grant execute on function public.owner_delete_announcement(text) to authenticated;
