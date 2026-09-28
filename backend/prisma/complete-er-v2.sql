-- Complete the ER-v2 role, room, and validation entities.
-- Integer identifiers are used to match the application's compact primary keys.

begin;

create table if not exists public."Admin" (
  "Admin_ID" integer primary key references public."Login"(id) on delete cascade,
  "Admin_Fname" varchar(50) not null,
  "Admin_Lname" varchar(50) not null,
  "Admin_Tel" varchar(15)
);

create table if not exists public."Audiovisual" (
  "AV_ID" integer primary key references public."Login"(id) on delete cascade,
  "AV_Fname" varchar(50) not null,
  "AV_Lname" varchar(50) not null,
  "AV_Tel" varchar(15),
  "Admin_ID" integer references public."Admin"("Admin_ID")
);

create table if not exists public."Examination_Conductor" (
  "EC_ID" integer primary key references public."Login"(id) on delete cascade,
  "EC_Fname" varchar(50) not null,
  "EC_Lname" varchar(50) not null,
  "EC_Tel" varchar(15),
  "Admin_ID" integer references public."Admin"("Admin_ID")
);

create table if not exists public."Teacher" (
  "T_ID" integer primary key references public."Login"(id) on delete cascade,
  "T_Fname" varchar(50) not null,
  "T_Lname" varchar(50) not null,
  "T_Tel" varchar(15),
  "Admin_ID" integer references public."Admin"("Admin_ID")
);

create table if not exists public."Room" (
  "Room_ID" integer generated always as identity primary key,
  "Room_Name" varchar(100) not null unique
);

create table if not exists public."Exam_Validation" (
  "Validation_ID" integer generated always as identity primary key,
  "Exam_ID" integer not null references public."Exam"(id) on delete cascade,
  "AV_ID" integer not null references public."Login"(id),
  "Check_Date" timestamptz not null default now(),
  "Result" varchar(20) not null check ("Result" in ('PASS', 'FAIL')),
  "Reason" text
);

-- Rebuild role profiles from Login; names without a surname use '-'.
insert into public."Admin" ("Admin_ID", "Admin_Fname", "Admin_Lname", "Admin_Tel")
select id, split_part(trim(full_name), ' ', 1),
       case when position(' ' in trim(full_name)) > 0 then substring(trim(full_name) from position(' ' in trim(full_name)) + 1) else '-' end,
       left(phone, 15)
from public."Login" where role::text = 'ADMIN'
on conflict ("Admin_ID") do update set "Admin_Fname"=excluded."Admin_Fname", "Admin_Lname"=excluded."Admin_Lname", "Admin_Tel"=excluded."Admin_Tel";

insert into public."Audiovisual" ("AV_ID", "AV_Fname", "AV_Lname", "AV_Tel", "Admin_ID")
select id, split_part(trim(full_name), ' ', 1),
       case when position(' ' in trim(full_name)) > 0 then substring(trim(full_name) from position(' ' in trim(full_name)) + 1) else '-' end,
       left(phone, 15), (select min("Admin_ID") from public."Admin")
from public."Login" where role::text = 'AV_STAFF'
on conflict ("AV_ID") do update set "AV_Fname"=excluded."AV_Fname", "AV_Lname"=excluded."AV_Lname", "AV_Tel"=excluded."AV_Tel", "Admin_ID"=excluded."Admin_ID";

insert into public."Examination_Conductor" ("EC_ID", "EC_Fname", "EC_Lname", "EC_Tel", "Admin_ID")
select id, split_part(trim(full_name), ' ', 1),
       case when position(' ' in trim(full_name)) > 0 then substring(trim(full_name) from position(' ' in trim(full_name)) + 1) else '-' end,
       left(phone, 15), (select min("Admin_ID") from public."Admin")
from public."Login" where role::text = 'COORDINATOR'
on conflict ("EC_ID") do update set "EC_Fname"=excluded."EC_Fname", "EC_Lname"=excluded."EC_Lname", "EC_Tel"=excluded."EC_Tel", "Admin_ID"=excluded."Admin_ID";

insert into public."Teacher" ("T_ID", "T_Fname", "T_Lname", "T_Tel", "Admin_ID")
select id, split_part(trim(full_name), ' ', 1),
       case when position(' ' in trim(full_name)) > 0 then substring(trim(full_name) from position(' ' in trim(full_name)) + 1) else '-' end,
       left(phone, 15), (select min("Admin_ID") from public."Admin")
from public."Login" where role::text = 'INSTRUCTOR'
on conflict ("T_ID") do update set "T_Fname"=excluded."T_Fname", "T_Lname"=excluded."T_Lname", "T_Tel"=excluded."T_Tel", "Admin_ID"=excluded."Admin_ID";

insert into public."Room" ("Room_Name")
select distinct trim(room) from public."Exam_Schedule" where nullif(trim(room), '') is not null
on conflict ("Room_Name") do nothing;

-- Keep role entities current when users are created or edited.
create or replace function public.sync_er_role_profile()
returns trigger language plpgsql security definer set search_path=public as $$
declare admin_id integer; first_name text; last_name text;
begin
  first_name := coalesce(nullif(split_part(trim(new.full_name), ' ', 1), ''), '-');
  last_name := case when position(' ' in trim(new.full_name)) > 0 then substring(trim(new.full_name) from position(' ' in trim(new.full_name)) + 1) else '-' end;
  delete from "Admin" where "Admin_ID"=new.id and new.role::text <> 'ADMIN';
  delete from "Audiovisual" where "AV_ID"=new.id and new.role::text <> 'AV_STAFF';
  delete from "Examination_Conductor" where "EC_ID"=new.id and new.role::text <> 'COORDINATOR';
  delete from "Teacher" where "T_ID"=new.id and new.role::text <> 'INSTRUCTOR';
  select min("Admin_ID") into admin_id from "Admin";
  if new.role::text='ADMIN' then insert into "Admin" values(new.id,first_name,last_name,left(new.phone,15)) on conflict("Admin_ID") do update set "Admin_Fname"=excluded."Admin_Fname","Admin_Lname"=excluded."Admin_Lname","Admin_Tel"=excluded."Admin_Tel";
  elsif new.role::text='AV_STAFF' then insert into "Audiovisual" values(new.id,first_name,last_name,left(new.phone,15),admin_id) on conflict("AV_ID") do update set "AV_Fname"=excluded."AV_Fname","AV_Lname"=excluded."AV_Lname","AV_Tel"=excluded."AV_Tel";
  elsif new.role::text='COORDINATOR' then insert into "Examination_Conductor" values(new.id,first_name,last_name,left(new.phone,15),admin_id) on conflict("EC_ID") do update set "EC_Fname"=excluded."EC_Fname","EC_Lname"=excluded."EC_Lname","EC_Tel"=excluded."EC_Tel";
  elsif new.role::text='INSTRUCTOR' then insert into "Teacher" values(new.id,first_name,last_name,left(new.phone,15),admin_id) on conflict("T_ID") do update set "T_Fname"=excluded."T_Fname","T_Lname"=excluded."T_Lname","T_Tel"=excluded."T_Tel";
  end if;
  return new;
end $$;
drop trigger if exists login_sync_er_role on public."Login";
create trigger login_sync_er_role after insert or update on public."Login" for each row execute function public.sync_er_role_profile();

commit;
