-- SPACE 프로젝트 공유 기록용 Supabase 스키마
-- 학생 이름은 저장하지 않습니다. 4반/6반 + 번호 -> 모둠만 매핑합니다.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.space_students (
  id uuid primary key default gen_random_uuid(),
  class_no smallint not null check (class_no in (4, 6)),
  student_no smallint not null check (student_no between 1 and 40),
  team_no smallint not null check (team_no between 1 and 10),
  unique (class_no, student_no)
);

create table if not exists public.space_sessions (
  token_hash text primary key,
  student_id uuid not null references public.space_students(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.space_group_records (
  class_no smallint not null,
  team_no smallint not null,
  key text not null,
  value text not null default '',
  rev integer not null default 1,
  updated_at timestamptz not null default now(),
  actor_student_no smallint not null,
  primary key (class_no, team_no, key)
);

create table if not exists public.space_personal_records (
  student_id uuid not null references public.space_students(id) on delete cascade,
  key text not null,
  value text not null default '',
  rev integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (student_id, key)
);

create table if not exists public.space_team_state (
  class_no smallint not null,
  team_no smallint not null,
  published boolean not null default false,
  primary key (class_no, team_no)
);

create table if not exists public.space_snapshots (
  id uuid primary key default gen_random_uuid(),
  class_no smallint not null,
  team_no smallint not null,
  label text not null,
  body jsonb not null,
  actor_student_no smallint not null,
  created_at timestamptz not null default now()
);

alter table public.space_students enable row level security;
alter table public.space_sessions enable row level security;
alter table public.space_group_records enable row level security;
alter table public.space_personal_records enable row level security;
alter table public.space_team_state enable row level security;
alter table public.space_snapshots enable row level security;

revoke all on public.space_students from anon, authenticated;
revoke all on public.space_sessions from anon, authenticated;
revoke all on public.space_group_records from anon, authenticated;
revoke all on public.space_personal_records from anon, authenticated;
revoke all on public.space_team_state from anon, authenticated;
revoke all on public.space_snapshots from anon, authenticated;

-- 3학년 4반, 6반 모둠 편성
insert into public.space_students (class_no, student_no, team_no) values
  (4,3,1),(4,9,1),(4,12,1),(4,24,1),
  (4,4,2),(4,13,2),(4,22,2),(4,25,2),
  (4,2,3),(4,6,3),(4,19,3),(4,20,3),
  (4,8,4),(4,11,4),(4,16,4),(4,18,4),
  (4,1,5),(4,5,5),(4,10,5),(4,14,5),(4,23,5),
  (4,7,6),(4,15,6),(4,17,6),(4,21,6),(4,26,6),
  (6,3,1),(6,16,1),(6,21,1),(6,23,1),
  (6,1,2),(6,11,2),(6,12,2),(6,18,2),
  (6,13,3),(6,17,3),(6,24,3),(6,25,3),
  (6,4,4),(6,6,4),(6,9,4),(6,22,4),
  (6,2,5),(6,10,5),(6,14,5),(6,15,5),(6,26,5),
  (6,5,6),(6,7,6),(6,8,6),(6,19,6),(6,20,6)
on conflict (class_no, student_no)
do update set team_no = excluded.team_no;

insert into public.space_team_state (class_no, team_no)
select c, t
from (values (4),(6)) classes(c)
cross join generate_series(1,6) as teams(t)
on conflict do nothing;

create or replace function public.space_require_student(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_student uuid;
begin
  if p_token is null or length(p_token) < 40 then
    raise exception '입장 정보가 없습니다.';
  end if;

  select student_id into v_student
  from public.space_sessions
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and expires_at > now();

  if v_student is null then
    raise exception '접속 시간이 끝났어요. 반과 번호로 다시 들어오세요.';
  end if;

  return v_student;
end;
$$;

create or replace function public.space_build_state(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  s public.space_students%rowtype;
  v_group jsonb;
  v_personal jsonb;
  v_snapshots jsonb;
  v_published boolean;
begin
  select * into s from public.space_students where id = p_student_id;
  if s.id is null then raise exception '학생 정보를 찾지 못했습니다.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', r.key,
    'value', r.value,
    'rev', r.rev,
    'updated', r.updated_at,
    'actor', s.class_no::text || '반 ' || r.actor_student_no::text || '번'
  ) order by r.key), '[]'::jsonb)
  into v_group
  from public.space_group_records r
  where r.class_no=s.class_no and r.team_no=s.team_no;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', r.key,
    'value', r.value,
    'rev', r.rev,
    'updated', r.updated_at,
    'actor', s.class_no::text || '반 ' || s.student_no::text || '번'
  ) order by r.key), '[]'::jsonb)
  into v_personal
  from public.space_personal_records r
  where r.student_id=s.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id::text,
    'label', x.label,
    'created', x.created_at,
    'body', x.body::text
  ) order by x.created_at desc), '[]'::jsonb)
  into v_snapshots
  from (
    select *
    from public.space_snapshots
    where class_no=s.class_no and team_no=s.team_no
    order by created_at desc
    limit 20
  ) x;

  select coalesce(published,false) into v_published
  from public.space_team_state
  where class_no=s.class_no and team_no=s.team_no;

  return jsonb_build_object(
    'student', jsonb_build_object(
      'id', 'student-' || s.class_no::text || '-' || s.student_no::text,
      'number', s.student_no,
      'teamId', 'team-' || s.class_no::text || '-' || s.team_no::text,
      'classId', 'class-' || s.class_no::text,
      'className', '3학년 ' || s.class_no::text || '반',
      'teamLabel', s.team_no::text || '조',
      'closed', false
    ),
    'group', v_group,
    'personal', v_personal,
    'snapshots', v_snapshots,
    'published', v_published
  );
end;
$$;

create or replace function public.space_join(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_class smallint;
  v_number smallint;
  s public.space_students%rowtype;
  v_token text;
  v_exp timestamptz;
  v_state jsonb;
begin
  if p_code is null or p_code !~ '^[46]-0?([1-9]|[12][0-9]|3[0-9]|40)$' then
    raise exception '4반 또는 6반과 번호를 확인해 주세요.';
  end if;

  v_class := split_part(p_code, '-', 1)::smallint;
  v_number := split_part(p_code, '-', 2)::smallint;

  select * into s
  from public.space_students
  where class_no=v_class and student_no=v_number;

  if s.id is null then
    raise exception '입력한 반과 번호를 편성표에서 찾지 못했습니다.';
  end if;

  delete from public.space_sessions where expires_at <= now();

  v_token := encode(gen_random_bytes(32), 'hex');
  v_exp := now() + interval '30 days';

  insert into public.space_sessions(token_hash, student_id, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), s.id, v_exp);

  v_state := public.space_build_state(s.id);

  return v_state || jsonb_build_object(
    'session', jsonb_build_object(
      'token', v_token,
      'expiresAt', floor(extract(epoch from v_exp) * 1000)::bigint
    )
  );
end;
$$;

create or replace function public.space_state(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select public.space_build_state(public.space_require_student(p_token));
$$;

create or replace function public.space_save(
  p_token text,
  p_key text,
  p_value text,
  p_rev integer,
  p_personal boolean,
  p_expected_team_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_student_id uuid;
  s public.space_students%rowtype;
  v_current_rev integer;
  v_row jsonb;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{1,80}$' then
    raise exception '기록 항목을 확인해 주세요.';
  end if;
  if length(coalesce(p_value,'')) > 3000 then
    raise exception '한 칸에는 3000자까지 저장할 수 있어요.';
  end if;

  v_student_id := public.space_require_student(p_token);
  select * into s from public.space_students where id=v_student_id;

  if not p_personal and p_expected_team_id is distinct from ('team-' || s.class_no::text || '-' || s.team_no::text) then
    raise exception '모둠 편성이 바뀌었어요. 화면을 새로고침해 주세요.';
  end if;

  if p_personal then
    select rev into v_current_rev
    from public.space_personal_records
    where student_id=s.id and key=p_key;

    if coalesce(v_current_rev,0) <> coalesce(p_rev,0) then
      select jsonb_build_object(
        'key', r.key, 'value', r.value, 'rev', r.rev,
        'updated', r.updated_at,
        'actor', s.class_no::text || '반 ' || s.student_no::text || '번'
      ) into v_row
      from public.space_personal_records r
      where r.student_id=s.id and r.key=p_key;
      return jsonb_build_object('conflict',true,'current',coalesce(v_row,'{}'::jsonb));
    end if;

    insert into public.space_personal_records(student_id,key,value,rev,updated_at)
    values(s.id,p_key,coalesce(p_value,''),coalesce(p_rev,0)+1,now())
    on conflict(student_id,key) do update
    set value=excluded.value, rev=excluded.rev, updated_at=excluded.updated_at;

    select jsonb_build_object(
      'key', r.key, 'value', r.value, 'rev', r.rev,
      'updated', r.updated_at,
      'actor', s.class_no::text || '반 ' || s.student_no::text || '번'
    ) into v_row
    from public.space_personal_records r
    where r.student_id=s.id and r.key=p_key;
  else
    select rev into v_current_rev
    from public.space_group_records
    where class_no=s.class_no and team_no=s.team_no and key=p_key;

    if coalesce(v_current_rev,0) <> coalesce(p_rev,0) then
      select jsonb_build_object(
        'key', r.key, 'value', r.value, 'rev', r.rev,
        'updated', r.updated_at,
        'actor', s.class_no::text || '반 ' || r.actor_student_no::text || '번'
      ) into v_row
      from public.space_group_records r
      where r.class_no=s.class_no and r.team_no=s.team_no and r.key=p_key;
      return jsonb_build_object('conflict',true,'current',coalesce(v_row,'{}'::jsonb));
    end if;

    insert into public.space_group_records(class_no,team_no,key,value,rev,updated_at,actor_student_no)
    values(s.class_no,s.team_no,p_key,coalesce(p_value,''),coalesce(p_rev,0)+1,now(),s.student_no)
    on conflict(class_no,team_no,key) do update
    set value=excluded.value, rev=excluded.rev, updated_at=excluded.updated_at,
        actor_student_no=excluded.actor_student_no;

    select jsonb_build_object(
      'key', r.key, 'value', r.value, 'rev', r.rev,
      'updated', r.updated_at,
      'actor', s.class_no::text || '반 ' || r.actor_student_no::text || '번'
    ) into v_row
    from public.space_group_records r
    where r.class_no=s.class_no and r.team_no=s.team_no and r.key=p_key;
  end if;

  return v_row;
end;
$$;

create or replace function public.space_snapshot_create(
  p_token text,
  p_label text,
  p_expected_team_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_student_id uuid;
  s public.space_students%rowtype;
  v_body jsonb;
  v_id uuid;
  v_created timestamptz;
begin
  v_student_id := public.space_require_student(p_token);
  select * into s from public.space_students where id=v_student_id;

  if p_expected_team_id is distinct from ('team-' || s.class_no::text || '-' || s.team_no::text) then
    raise exception '모둠 편성이 바뀌었어요. 화면을 새로고침해 주세요.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',r.key,'value',r.value,'rev',r.rev,'updated',r.updated_at,
    'actor',s.class_no::text || '반 ' || r.actor_student_no::text || '번'
  ) order by r.key),'[]'::jsonb)
  into v_body
  from public.space_group_records r
  where r.class_no=s.class_no and r.team_no=s.team_no;

  insert into public.space_snapshots(class_no,team_no,label,body,actor_student_no)
  values(s.class_no,s.team_no,left(coalesce(p_label,'보관본'),80),v_body,s.student_no)
  returning id,created_at into v_id,v_created;

  return jsonb_build_object('id',v_id::text,'label',left(coalesce(p_label,'보관본'),80),'created',v_created,'body',v_body::text);
end;
$$;

create or replace function public.space_snapshot_get(p_token text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_student_id uuid;
  s public.space_students%rowtype;
  x public.space_snapshots%rowtype;
begin
  v_student_id := public.space_require_student(p_token);
  select * into s from public.space_students where id=v_student_id;
  select * into x from public.space_snapshots
  where id=p_id and class_no=s.class_no and team_no=s.team_no;

  if x.id is null then raise exception '보관본을 찾지 못했습니다.'; end if;
  return jsonb_build_object('id',x.id::text,'label',x.label,'created',x.created_at,'body',x.body::text);
end;
$$;

create or replace function public.space_publish(
  p_token text,
  p_published boolean,
  p_expected_team_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_student_id uuid;
  s public.space_students%rowtype;
begin
  v_student_id := public.space_require_student(p_token);
  select * into s from public.space_students where id=v_student_id;
  if p_expected_team_id is distinct from ('team-' || s.class_no::text || '-' || s.team_no::text) then
    raise exception '모둠 편성이 바뀌었어요. 화면을 새로고침해 주세요.';
  end if;

  insert into public.space_team_state(class_no,team_no,published)
  values(s.class_no,s.team_no,coalesce(p_published,false))
  on conflict(class_no,team_no) do update set published=excluded.published;

  return jsonb_build_object('published',coalesce(p_published,false));
end;
$$;

create or replace function public.space_gallery(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_student_id uuid;
  s public.space_students%rowtype;
  v_teams jsonb;
begin
  v_student_id := public.space_require_student(p_token);
  select * into s from public.space_students where id=v_student_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id','team-' || s.class_no::text || '-' || t.team_no::text,
    'label',t.team_no::text || '조',
    'records',coalesce((
      select jsonb_agg(jsonb_build_object(
        'key',r.key,'value',r.value,'rev',r.rev,'updated',r.updated_at,
        'actor',s.class_no::text || '반 ' || r.actor_student_no::text || '번'
      ) order by r.key)
      from public.space_group_records r
      where r.class_no=s.class_no and r.team_no=t.team_no
    ),'[]'::jsonb)
  ) order by t.team_no),'[]'::jsonb)
  into v_teams
  from public.space_team_state t
  where t.class_no=s.class_no and t.published=true;

  return jsonb_build_object('teams',v_teams);
end;
$$;

create or replace function public.space_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  delete from public.space_sessions
  where token_hash=encode(digest(p_token,'sha256'),'hex');
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.space_require_student(text) from public, anon, authenticated;
revoke all on function public.space_build_state(uuid) from public, anon, authenticated;

grant execute on function public.space_join(text) to anon, authenticated;
grant execute on function public.space_state(text) to anon, authenticated;
grant execute on function public.space_save(text,text,text,integer,boolean,text) to anon, authenticated;
grant execute on function public.space_snapshot_create(text,text,text) to anon, authenticated;
grant execute on function public.space_snapshot_get(text,uuid) to anon, authenticated;
grant execute on function public.space_publish(text,boolean,text) to anon, authenticated;
grant execute on function public.space_gallery(text) to anon, authenticated;
grant execute on function public.space_logout(text) to anon, authenticated;
