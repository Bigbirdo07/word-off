-- Create a table for player profiles
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  secret_code text not null, -- Simple password for this prototype
  rank_tier text default 'Lead III',
  rank_points int default 0,
  current_streak INTEGER DEFAULT 0,
  words_solved INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login date default CURRENT_DATE,
  login_streak int default 1
);

-- Create a table for match history
create table if not exists match_history (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references players(id) not null,
  opponent_name text,
  result text, -- 'win', 'loss'
  score int,
  rp_change int default 0,
  words_solved text[] default '{}',
  created_at timestamptz default now()
);

-- Enable RLS (Row Level Security)
alter table players enable row level security;
alter table match_history enable row level security;

-- ALLOW ALL (for this prototype phase only)
-- In production, we would use Supabase Auth (GoTrue) policies
create policy "Allow public read/write access to players"
on players for all using (true) with check (true);

create policy "Allow public read/write access to match_history"
on match_history for all using (true) with check (true);
