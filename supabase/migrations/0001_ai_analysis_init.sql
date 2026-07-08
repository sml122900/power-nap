-- Phase A — AI_ANALYSIS.md §4/§7 스키마 + 크레딧 원장 로직.
-- 결제(Phase D)/AI 파이프라인(Phase B) 없이 크레딧 차감까지 동작하는 게 목표.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.credits (
  user_id uuid primary key references public.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('purchase', 'weekly_free', 'analysis', 'refund')),
  external_id text unique, -- RevenueCat 거래 ID 등, 중복 적립 방지
  created_at timestamptz not null default now()
);

create table public.analyses (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  records_snapshot jsonb not null,
  report jsonb,
  followup_turns_used smallint not null default 0 check (followup_turns_used between 0 and 3),
  model text,
  tokens_in integer,
  tokens_out integer
);

-- 익명 auth로 auth.users에 새 유저가 생기면 users/credits 행을 자동으로 만든다.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id);
  insert into public.credits (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 크레딧 원장 로직 핵심: credit_events insert만이 잔액을 바꾸는 유일한 경로.
-- Edge Function은 항상 credit_events에 delta를 insert하고, 여기서 credits.balance에 반영한다.
-- balance의 check(>= 0) 제약이 있어 잔액 이상으로 소비(delta 음수)하면 insert 자체가 롤백된다
-- — "클라이언트 값은 신뢰하지 않는다"는 AI_ANALYSIS.md §3 원칙을 DB 레벨에서 강제.
create or replace function public.apply_credit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.credits
    set balance = balance + new.delta,
        updated_at = now()
    where user_id = new.user_id;
  return new;
end;
$$;

create trigger on_credit_event_insert
  after insert on public.credit_events
  for each row execute function public.apply_credit_event();

-- 주 1회 무료 판정: has_weekly_free()가 true면 "이번 주 무료 아직 안 씀" = 무료 분석 가능.
-- 이번 주(월요일 00:00 KST) 이후 reason='weekly_free' 이벤트가 없을 때만 true.
-- weekly_free 이벤트는 delta=0으로 남긴다 — 잔액에 영향 없이 "이번 주 무료 소진" 표식 역할.
create or replace function public.week_start_kst(ts timestamptz default now())
returns timestamptz
language sql
stable
as $$
  select date_trunc('week', ts at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;

create or replace function public.has_weekly_free(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.credit_events
    where user_id = p_user_id
      and reason = 'weekly_free'
      and created_at >= public.week_start_kst()
  );
$$;

-- RLS: 각 유저는 자기 행만 읽는다. insert/update는 정책이 없으므로 service_role(RLS 우회)
-- 전용 — 클라이언트(anon/authenticated 롤)는 절대 직접 쓸 수 없다.
alter table public.users enable row level security;
alter table public.credits enable row level security;
alter table public.credit_events enable row level security;
alter table public.analyses enable row level security;

create policy "users read own row" on public.users
  for select using (auth.uid() = id);

create policy "credits read own row" on public.credits
  for select using (auth.uid() = user_id);

create policy "credit_events read own rows" on public.credit_events
  for select using (auth.uid() = user_id);

create policy "analyses read own rows" on public.analyses
  for select using (auth.uid() = user_id);
