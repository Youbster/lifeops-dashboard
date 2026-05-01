-- LifeOps Supabase Schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

-- Tasks
create table if not exists tasks (
  id            text primary key,
  user_id       uuid references auth.users not null,
  title         text not null,
  category      text,
  due_date      date,
  priority      text default 'medium',
  type          text default 'todo',
  notes         text,
  duration      text,
  repeat        text,
  subtasks      jsonb default '[]',
  completed     boolean default false,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);
alter table tasks enable row level security;
create policy "Users own their tasks" on tasks for all using (auth.uid() = user_id);

-- Habits
create table if not exists habits (
  id          text primary key,
  user_id     uuid references auth.users not null,
  name        text not null,
  emoji       text,
  history     jsonb default '{}',
  archived    boolean default false,
  created_at  timestamptz default now()
);
alter table habits enable row level security;
create policy "Users own their habits" on habits for all using (auth.uid() = user_id);

-- Goals
create table if not exists goals (
  id          text primary key,
  user_id     uuid references auth.users not null,
  title       text not null,
  emoji       text,
  timeframe   text,
  description text,
  progress    int default 0,
  status      text default 'active',
  created_at  timestamptz default now()
);
alter table goals enable row level security;
create policy "Users own their goals" on goals for all using (auth.uid() = user_id);

-- XP + Achievements (single row per user)
create table if not exists user_progress (
  user_id                uuid primary key references auth.users,
  total_xp               int default 0,
  unlocked_achievements  jsonb default '[]',
  updated_at             timestamptz default now()
);
alter table user_progress enable row level security;
create policy "Users own their progress" on user_progress for all using (auth.uid() = user_id);
