create table if not exists public.attendance (
  id uuid default gen_random_uuid() primary key,
  registration_id uuid not null references registrations(id),
  member_name text not null,
  is_present boolean default false not null,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_member_attendance unique (registration_id, member_name)
);

-- Add RLS policies
alter table public.attendance enable row level security;

create policy "Anyone can read attendance records"
  on attendance
  for select using (true);

create policy "Anyone can create attendance records"
  on attendance
  for insert
  using (true);

create policy "Anyone can update attendance records"
  on attendance
  for update
  using (true);

-- Create a function to get team attendance URL
create or replace function get_team_attendance_url(reg_code text)
returns text
language sql
security definer
as $$
  -- Return just the path portion, frontend will add the domain
  select '/attendance/' || reg_code;
$$;