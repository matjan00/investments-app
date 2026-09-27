-- Tables for the investments app. Run once in Supabase → SQL Editor.

create table if not exists accounts (
  id text primary key,
  name text not null,
  counts_for_goal boolean not null default true,  -- false for IKE (not used for the down payment)
  sort int not null default 0
);

create table if not exists instruments (
  id text primary key,                 -- short code, e.g. EUNL or EDO0233
  name text not null,
  kind text not null check (kind in ('etf', 'bond')),
  yahoo_symbol text,                   -- ETFs only, e.g. EUNL.DE
  currency text,
  price_native numeric,
  price_pln numeric,
  prev_price_pln numeric,
  price_date date,
  bond_margin numeric,                 -- bonds only: margin over inflation (%)
  bond_rates numeric[] not null default '{}',  -- bonds only: rate (%) for year 1, 2, 3...
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id bigint generated always as identity primary key,
  date date not null,
  account_id text not null references accounts(id),
  instrument_id text not null references instruments(id),
  type text not null default 'buy' check (type in ('buy', 'sell')),
  units numeric not null check (units > 0),
  price_pln numeric not null check (price_pln >= 0),  -- price per unit in zł
  fee_pln numeric not null default 0,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists snapshots (
  date date primary key,
  total_pln numeric not null,
  cost_pln numeric not null,
  goal_pln numeric not null,       -- everything except IKE, plus cash
  goal_cost_pln numeric not null
);

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  home_price numeric not null default 1000000,
  down_payment_pct numeric not null default 30,
  cash_pln numeric not null default 0,
  monthly_pln numeric not null default 5000,
  expected_return numeric not null default 4.5
);

-- Only logged-in users (you two) can read or change anything.
do $$
declare t text;
begin
  foreach t in array array['accounts', 'instruments', 'transactions', 'snapshots', 'settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "family access" on %I', t);
    execute format('create policy "family access" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select, insert, update, delete on accounts, instruments, transactions, snapshots, settings to authenticated;
grant all on accounts, instruments, transactions, snapshots, settings to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
