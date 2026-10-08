-- BIG ALIEN VENTURE — production database schema for Supabase
-- Run this entire file in Supabase SQL Editor.
-- It creates auth-linked profiles, products, orders, order items, shipment updates,
-- storage policies, RLS policies, and a safe admin-role model.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'Other',
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer','paystack')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  order_status text not null default 'processing' check (order_status in ('processing','confirmed','shipped','out_for_delivery','delivered','cancelled')),
  tracking_number text,
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_price numeric(12,2) not null check (product_price >= 0),
  quantity integer not null check (quantity > 0),
  image_url text
);

create table if not exists public.shipment_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  message text not null default '',
  location text,
  created_at timestamptz not null default now()
);

-- Profile row is created automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper used by RLS. Role comes from a server-controlled column, not user-editable metadata.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute procedure public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipment_updates enable row level security;

-- Profiles
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "admin reads all profiles" on public.profiles;
create policy "admin reads all profiles" on public.profiles
for select to authenticated using (public.is_admin());

-- Products: everyone can see active products; admins manage all.
drop policy if exists "public reads active products" on public.products;
create policy "public reads active products" on public.products
for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists "admins insert products" on public.products;
create policy "admins insert products" on public.products
for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update products" on public.products;
create policy "admins update products" on public.products
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete products" on public.products;
create policy "admins delete products" on public.products
for delete to authenticated using (public.is_admin());

-- Orders: customers see only their own; admins see/manage all.
drop policy if exists "customers create own orders" on public.orders;
create policy "customers create own orders" on public.orders
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders" on public.orders
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Order items
drop policy if exists "customers read own order items" on public.order_items;
create policy "customers read own order items" on public.order_items
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "customers insert own order items" on public.order_items;
create policy "customers insert own order items" on public.order_items
for insert to authenticated with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
);

-- Shipment updates
drop policy if exists "customers read own shipment updates" on public.shipment_updates;
create policy "customers read own shipment updates" on public.shipment_updates
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "admins insert shipment updates" on public.shipment_updates;
create policy "admins insert shipment updates" on public.shipment_updates
for insert to authenticated with check (public.is_admin());

-- Storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images','product-images',true)
on conflict (id) do update set public = true;

drop policy if exists "public product images read" on storage.objects;
create policy "public product images read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins update product images" on storage.objects;
create policy "admins update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());

-- Helpful indexes
create index if not exists products_category_idx on public.products(category);
create index if not exists products_active_idx on public.products(active);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists shipment_updates_order_id_idx on public.shipment_updates(order_id, created_at);

-- IMPORTANT: after creating your own account in the website, make that account admin
-- by running this in SQL Editor, replacing the email with your owner email:
--
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'YOUR_OWNER_EMAIL');
--
-- Never put your database password or service_role key into the website.
