-- STUDY POINT LIBRARY V2 - Supabase schema
create extension if not exists pgcrypto;
create type public.user_role as enum ('student','admin');
create type public.seat_status as enum ('available','occupied','reserved');
create type public.plan_type as enum ('hall1_full','hall2_full','hall2_morning','hall2_evening');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, student_id text unique, full_name text not null, phone text, role public.user_role not null default 'student', created_at timestamptz not null default now());
create table public.seats (id uuid primary key default gen_random_uuid(), hall text not null check(hall in ('Hall 1','Hall 2')), seat_number text not null, plan_type public.plan_type, status public.seat_status not null default 'available', reserved_by uuid references public.profiles(id) on delete set null, unique(hall,seat_number));
create table public.memberships (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade, plan public.plan_type not null, start_date date not null, end_date date not null, amount numeric(10,2) not null, payment_status text not null default 'pending' check(payment_status in ('paid','pending','overdue')), locker boolean not null default false, locker_deposit numeric(10,2) not null default 0, created_at timestamptz not null default now());
create table public.attendance (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade, seat_id uuid references public.seats(id) on delete set null, check_in timestamptz not null, check_out timestamptz, duration_seconds bigint generated always as (case when check_out is not null then extract(epoch from (check_out-check_in))::bigint else null end) stored, created_at timestamptz not null default now());
create unique index one_open_attendance_per_student on public.attendance(student_id) where check_out is null;
create table public.payments (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade, membership_id uuid references public.memberships(id) on delete set null, amount numeric(10,2) not null, paid_on date, method text, status text not null default 'pending', reference text, created_at timestamptz not null default now());
create table public.notices (id uuid primary key default gen_random_uuid(), title text not null, body text not null, published boolean not null default true, created_at timestamptz not null default now());
create table public.facilities (id uuid primary key default gen_random_uuid(), name text unique not null, icon text, enabled boolean not null default true, sort_order int not null default 0);
insert into public.facilities(name,icon,sort_order) values ('Free Wi-Fi','📶',1),('AC Study Halls','❄️',2),('RO Drinking Water','💧',3),('Silent Study Environment','🔇',4),('Power Facility','🔌',5),('Locker Facility','🔐',6) on conflict(name) do nothing;
insert into public.seats(hall,seat_number,plan_type) select 'Hall 1', chr(65+r)||c, 'hall1_full'::public.plan_type from generate_series(0,5) r cross join generate_series(1,5) c on conflict do nothing;
insert into public.seats(hall,seat_number,plan_type) select 'Hall 2', s::text, null from generate_series(1,40) s on conflict do nothing;
-- Admin role is set manually after creating the owner's Auth account.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
alter table public.profiles enable row level security; alter table public.seats enable row level security; alter table public.memberships enable row level security; alter table public.attendance enable row level security; alter table public.payments enable row level security; alter table public.notices enable row level security; alter table public.facilities enable row level security;
create policy profiles_self_or_admin on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy profiles_update_self_or_admin on public.profiles for update using (id=auth.uid() or public.is_admin());
create policy seats_read_authenticated on public.seats for select to authenticated using (true);
create policy seats_admin_write on public.seats for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy membership_self_or_admin on public.memberships for select using (student_id=auth.uid() or public.is_admin());
create policy membership_admin_write on public.memberships for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy attendance_self_or_admin on public.attendance for select using (student_id=auth.uid() or public.is_admin());
create policy attendance_student_insert on public.attendance for insert to authenticated with check (student_id=auth.uid());
create policy attendance_student_update on public.attendance for update using (student_id=auth.uid() or public.is_admin()) with check (student_id=auth.uid() or public.is_admin());
create policy payments_self_or_admin on public.payments for select using (student_id=auth.uid() or public.is_admin());
create policy payments_admin_write on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notices_read on public.notices for select using (published=true or public.is_admin());
create policy notices_admin_write on public.notices for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy facilities_read on public.facilities for select using (enabled=true or public.is_admin());
create policy facilities_admin_write on public.facilities for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Enable realtime for live seat/attendance changes. If your project does not allow this statement, add these tables through Dashboard > Database > Replication.
alter publication supabase_realtime add table public.seats;
alter publication supabase_realtime add table public.attendance;
