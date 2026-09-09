-- MyLekhapal core Postgres schema for Supabase.
-- Run through the Supabase CLI or SQL Editor using a project owner/admin session.
-- Application service-role requests must remain server-only; browser clients use RLS.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  pan text,
  gstins text[] not null default '{}',
  financial_year_start_month smallint not null default 4 check (financial_year_start_month between 1 and 12),
  default_currency text not null default 'INR',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','representative','accountant','ca_partner','preparer','reviewer','approver','auditor')),
  status text not null default 'active' check (status in ('active','invited','revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id, user_id, role)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  ca_business_id uuid not null references public.businesses(id) on delete cascade,
  client_business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now(),
  unique (ca_business_id, client_business_id)
);

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','income','expense')),
  parent_id uuid references public.chart_of_accounts(id),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  entry_number text not null,
  entry_type text not null,
  transaction_date date not null,
  posting_date date,
  financial_year text not null,
  period text not null,
  description text not null,
  source_method text not null check (source_method in ('manual','excel_csv_import','invoice_upload','receipt_upload','bank_statement','connected_system','automated_recurring')),
  status text not null default 'draft' check (status in ('draft','pending_clarification','pending_review','approved','posted','rejected','reversed')),
  confidence text check (confidence in ('high','medium','low')),
  preparer_id uuid references auth.users(id),
  reviewer_id uuid references auth.users(id),
  approver_id uuid references auth.users(id),
  reversal_of_entry_id uuid references public.journal_entries(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, entry_number)
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  account_id uuid not null references public.chart_of_accounts(id),
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  cost_centre text,
  project text,
  department text,
  narration text,
  check ((debit = 0) <> (credit = 0)),
  unique (entry_id, line_no)
);

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_id uuid references public.journal_entries(id) on delete set null,
  doc_type text not null,
  storage_provider text not null check (storage_provider in ('google_drive','internal_temp','ephemeral_processed_only')),
  google_file_id text,
  file_name text not null,
  file_hash text not null,
  extracted_fields jsonb,
  ocr_confidence text check (ocr_confidence in ('high','medium','low')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','disputed')),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id, file_hash)
);

create table if not exists public.exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  exception_type text not null,
  risk_level text not null check (risk_level in ('low','medium','high')),
  required_action text not null,
  assigned_reviewer_id uuid references auth.users(id),
  resolution_status text not null default 'open' check (resolution_status in ('open','resolved','accepted_risk')),
  resolution_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_file_hash text not null,
  uploaded_by uuid not null references auth.users(id),
  row_count integer not null default 0,
  rows_created integer not null default 0,
  rows_duplicate integer not null default 0,
  rows_failed integer not null default 0,
  rows_pending integer not null default 0,
  rows_excluded integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  column_mapping jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.gst_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gstin text not null,
  period text not null,
  output_tax_liability numeric(18,2),
  reverse_charge_liability numeric(18,2),
  eligible_itc numeric(18,2),
  estimated_net_payable numeric(18,2),
  gstr1_status text,
  gstr3b_status text,
  challan_status text,
  ca_review_status text,
  computed_at timestamptz not null default now(),
  unique (business_id, gstin, period)
);

create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  connected_by_user_id uuid not null references auth.users(id),
  google_account_email text not null,
  scope_granted text not null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  sync_status text not null default 'not_connected',
  revoked_at timestamptz
);

create table if not exists public.google_synced_items (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.google_connections(id) on delete cascade,
  google_file_id text not null,
  google_file_type text not null check (google_file_type in ('sheet','doc','drive_folder')),
  purpose text not null check (purpose in ('source_documents','export_target','import_source')),
  last_synced_at timestamptz,
  sync_status text not null,
  last_error text,
  unique (connection_id, google_file_id)
);

create table if not exists public.approval_matrix (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null,
  threshold numeric(18,2) not null check (threshold >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  actor_user_id uuid references auth.users(id),
  actor_type text not null check (actor_type in ('human','ai_draft','system')),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id),
  event_type text not null check (event_type in ('ai_document_processed','ai_tokens','import_row','export')),
  quantity bigint not null check (quantity >= 0),
  estimated_cost numeric(18,6) not null default 0 check (estimated_cost >= 0),
  created_at timestamptz not null default now()
);

create index if not exists journal_entries_business_period_idx on public.journal_entries (business_id, period, transaction_date desc);
create index if not exists exceptions_business_status_idx on public.exceptions (business_id, resolution_status);
create index if not exists usage_records_business_created_idx on public.usage_records (business_id, created_at desc);

create or replace function public.is_active_business_member(target_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_memberships m
    where m.business_id = target_business_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

revoke all on function public.is_active_business_member(uuid) from public;
grant execute on function public.is_active_business_member(uuid) to authenticated;

-- Enable RLS for every business-data table. Policies deliberately permit only active members.
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.clients enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.source_documents enable row level security;
alter table public.exceptions enable row level security;
alter table public.import_batches enable row level security;
alter table public.mapping_profiles enable row level security;
alter table public.gst_periods enable row level security;
alter table public.google_connections enable row level security;
alter table public.google_synced_items enable row level security;
alter table public.approval_matrix enable row level security;
alter table public.audit_log enable row level security;
alter table public.usage_records enable row level security;

create policy "business members can read businesses" on public.businesses for select to authenticated using (public.is_active_business_member(id));
create policy "creator can create business" on public.businesses for insert to authenticated with check (created_by = auth.uid());
create policy "members can read memberships" on public.business_memberships for select to authenticated using (public.is_active_business_member(business_id));

-- These tables all carry business_id and use the same tenant read boundary.
create policy "members read chart" on public.chart_of_accounts for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read entries" on public.journal_entries for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read source documents" on public.source_documents for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read exceptions" on public.exceptions for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read imports" on public.import_batches for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read mappings" on public.mapping_profiles for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read GST" on public.gst_periods for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read Google connections" on public.google_connections for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read approval matrix" on public.approval_matrix for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read audit log" on public.audit_log for select to authenticated using (public.is_active_business_member(business_id));
create policy "members read usage" on public.usage_records for select to authenticated using (public.is_active_business_member(business_id));

-- Writes must go through server-side role and approval checks. Do not add broad browser write policies.
