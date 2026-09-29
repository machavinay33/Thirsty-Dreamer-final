-- Thirsty Dreamer private contact inbox.
-- Run once in Supabase SQL Editor after the existing CMS schema is installed.
-- Public visitors can submit validated inquiries; only allowlisted CMS admins can read or change status.

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  email text not null check (
    length(email) between 3 and 254
    and email = lower(trim(email))
    and position('@' in email) > 1
  ),
  phone text not null check (
    length(trim(phone)) between 7 and 32
    and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15
  ),
  inquiry_type text not null check (inquiry_type in ('brand', 'speaking', 'events', 'blog', 'secret_diners', 'consultation', 'other')),
  message text not null check (length(trim(message)) between 20 and 5000),
  consent boolean not null check (consent is true),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries (created_at desc);
create index if not exists contact_inquiries_status_created_at_idx
  on public.contact_inquiries (status, created_at desc);

alter table public.contact_inquiries enable row level security;
revoke all on table public.contact_inquiries from public, anon, authenticated;
grant insert (full_name, email, phone, inquiry_type, message, consent)
  on table public.contact_inquiries to anon, authenticated;
grant select on table public.contact_inquiries to authenticated;
grant update (status) on table public.contact_inquiries to authenticated;

drop policy if exists "Visitors may send a contact inquiry" on public.contact_inquiries;
create policy "Visitors may send a contact inquiry" on public.contact_inquiries
  for insert to anon, authenticated
  with check (
    length(trim(full_name)) between 2 and 120
    and email = lower(trim(email))
    and length(trim(phone)) between 7 and 32
    and inquiry_type in ('brand', 'speaking', 'events', 'blog', 'secret_diners', 'consultation', 'other')
    and length(trim(message)) between 20 and 5000
    and consent is true
    and status = 'new'
  );

drop policy if exists "CMS admins may read contact inquiries" on public.contact_inquiries;
create policy "CMS admins may read contact inquiries" on public.contact_inquiries
  for select to authenticated
  using (public.is_site_admin());

drop policy if exists "CMS admins may update contact inquiry status" on public.contact_inquiries;
create policy "CMS admins may update contact inquiry status" on public.contact_inquiries
  for update to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());
