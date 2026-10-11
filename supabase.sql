-- ==========================================
-- SHARDA SELFSTUDY SUPABASE SQL SCHEMA & RLS
-- ==========================================

-- 1. PROFILES TABLE
create table public.profiles (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null unique,
    email text not null,
    full_name text not null,
    dob date,
    role text not null default 'student' check (role in ('admin', 'student')),
    status text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
    avatar_path text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. TESTS TABLE (Managed by Admin)
create table public.tests (
    id uuid default gen_random_uuid() primary key,
    test_name text not null,
    subject text not null,
    chapter text,
    test_date date not null,
    maximum_marks numeric not null check (maximum_marks > 0),
    description text,
    created_by uuid references public.profiles(user_id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. TEST RESULTS TABLE
create table public.test_results (
    id uuid default gen_random_uuid() primary key,
    test_id uuid references public.tests(id) on delete cascade,
    student_id uuid references public.profiles(user_id) on delete cascade not null,
    test_name text not null,
    subject text not null,
    marks_obtained numeric not null check (marks_obtained >= 0),
    maximum_marks numeric not null check (maximum_marks > 0),
    test_date date,
    remarks text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint marks_valid check (marks_obtained <= maximum_marks)
);

-- 4. ATTENDANCE SESSIONS TABLE
create table public.attendance_sessions (
    id uuid default gen_random_uuid() primary key,
    subject text not null,
    session_date date not null,
    topic text,
    created_by uuid references public.profiles(user_id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. ATTENDANCE RECORDS TABLE
create table public.attendance_records (
    id uuid default gen_random_uuid() primary key,
    session_id uuid references public.attendance_sessions(id) on delete cascade not null,
    student_id uuid references public.profiles(user_id) on delete cascade not null,
    status text not null check (status in ('present', 'absent', 'leave')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (session_id, student_id)
);

-- ==========================================
-- AUTOMATIC PROFILE TRIGGER ON AUTH SIGNUP
-- ==========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, dob, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Student'),
    (new.raw_user_meta_data->>'dob')::date,
    'student',
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
alter table public.profiles enable row level security;
alter table public.tests enable row level security;
alter table public.test_results enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

-- Helper function to check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- PROFILES POLICIES
create policy "Users can view their own profile or admins view all"
  on public.profiles for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Users can update their own editable profile fields"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and role = (select role from public.profiles where user_id = auth.uid()) and status = (select status from public.profiles where user_id = auth.uid()));

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

-- TESTS POLICIES
create policy "Anyone authenticated can view tests"
  on public.tests for select
  using (auth.role() = 'authenticated');

create policy "Admins can insert/update/delete tests"
  on public.tests for all
  using (public.is_admin())
  with check (public.is_admin());

-- TEST RESULTS POLICIES
create policy "Students view own test results, admins view all"
  on public.test_results for select
  using (auth.uid() = student_id or public.is_admin());

create policy "Admins manage test results"
  on public.test_results for all
  using (public.is_admin())
  with check (public.is_admin());

-- ATTENDANCE SESSIONS POLICIES
create policy "Authenticated users view attendance sessions"
  on public.attendance_sessions for select
  using (auth.role() = 'authenticated');

create policy "Admins manage attendance sessions"
  on public.attendance_sessions for all
  using (public.is_admin())
  with check (public.is_admin());

-- ATTENDANCE RECORDS POLICIES
create policy "Students view own attendance records, admins view all"
  on public.attendance_records for select
  using (auth.uid() = student_id or public.is_admin());

create policy "Admins manage attendance records"
  on public.attendance_records for all
  using (public.is_admin())
  with check (public.is_admin());

-- ==========================================
-- STORAGE BUCKET SETUP (Run in Supabase Dashboard SQL Editor)
-- ==========================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Users can update or delete their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid() = owner);