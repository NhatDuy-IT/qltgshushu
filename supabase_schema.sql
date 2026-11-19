-- ============================================================================
-- SHUSHU WORKSPACE (PHASE 2) — SUPABASE DATABASE SCHEMA & RLS
-- Chạy toàn bộ script này trong Supabase Dashboard -> SQL Editor -> Run
--
-- Bao gồm 9 bảng chuẩn hóa:
--   1. tasks_bookings      (Công việc, Booking khách hàng, Lịch cá nhân)
--   2. reminders           (Nhắc lịch thủ công & lặp lại)
--   3. finances            (Sổ Thu / Chi & Doanh thu Booking)
--   4. notes               (Quick Note & ghi chú nhanh)
--   5. projects            (Dự án Kanban & đầu việc con)
--   6. habits              (Habit Tracker & chuỗi ngày Streak)
--   7. clients             (Danh bạ khách hàng Mini CRM)
--   8. user_settings       (Cài đặt giao diện, Telegram Bot, App Lock PIN)
--   9. push_subscriptions  (Đăng ký Web Push của PC, iOS, Android)
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. TASKS & BOOKINGS
create table if not exists public.tasks_bookings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'task' check (type in ('task', 'booking', 'personal')),
  title text not null,
  client text default '',
  client_id text default '',
  client_phone text default '',
  date text default '',
  time text default '',
  duration integer not null default 60,
  status text not null default 'pending' check (status in ('pending', 'active', 'done')),
  is_deadline boolean not null default false,
  price numeric not null default 0,
  deposit numeric not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposited', 'paid')),
  remind_before integer not null default 30,
  reminder_sent boolean not null default false,
  notes text default '',
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_bookings_user_date
  on public.tasks_bookings (user_id, date, status);
create index if not exists idx_tasks_bookings_reminder
  on public.tasks_bookings (reminder_sent, status, date);

-- 2. REMINDERS
create table if not exists public.reminders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text default '',
  date text not null,
  time text not null default '09:00',
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'monthly')),
  completed boolean not null default false,
  sent boolean not null default false,
  sent_at timestamptz,
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reminders_due
  on public.reminders (completed, sent, date, time);

-- 3. FINANCES
create table if not exists public.finances (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  category text not null default 'Khác',
  amount numeric not null default 0,
  date text not null,
  booking_id text default '',
  notes text default '',
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finances_user_date
  on public.finances (user_id, date);

-- 4. NOTES
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text default 'Ghi chú nhanh',
  content text not null default '',
  tags jsonb not null default '[]'::jsonb,
  tint text not null default 'none',
  pinned boolean not null default false,
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. PROJECTS
create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  status text not null default 'idea' check (status in ('idea', 'doing', 'done')),
  deadline text default '',
  subtasks jsonb not null default '[]'::jsonb,
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. HABITS
create table if not exists public.habits (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default '✨',
  completed_dates jsonb not null default '[]'::jsonb,
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. CLIENTS (MINI CRM)
create table if not exists public.clients (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text default '',
  zalo text default '',
  location text default '',
  notes text default '',
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_user_name
  on public.clients (user_id, name);

-- 8. USER SETTINGS (Theme, App Lock PIN)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — CHỈ TÀI KHOẢN ĐÃ ĐĂNG NHẬP MỚI ĐƯỢC ĐỌC/GHI
-- ============================================================================

alter table public.tasks_bookings enable row level security;
alter table public.reminders enable row level security;
alter table public.finances enable row level security;
alter table public.notes enable row level security;
alter table public.projects enable row level security;
alter table public.habits enable row level security;
alter table public.clients enable row level security;
alter table public.user_settings enable row level security;

-- Helper: Drop existing policies before recreating cleanly
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'tasks_bookings', 'reminders', 'finances', 'notes',
    'projects', 'habits', 'clients', 'user_settings'
  ] loop
    execute format('drop policy if exists "Single user own rows" on public.%I', tbl);
    execute format(
      'create policy "Single user own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      tbl
    );
  end loop;
end $$;

-- ============================================================================
-- BẬT SUPABASE REALTIME CHO ĐỒNG BỘ PC <-> MOBILE
-- ============================================================================
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'tasks_bookings', 'reminders', 'finances', 'notes',
    'projects', 'habits', 'clients', 'user_settings'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;
