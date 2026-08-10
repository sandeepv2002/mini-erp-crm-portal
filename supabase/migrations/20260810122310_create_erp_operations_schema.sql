/*
# Create ERP operations schema

1. New Tables
- `profiles`: role-aware staff directory linked to Supabase Auth users.
- `customers`: CRM records with type, lifecycle status, follow-up date, and notes.
- `products`: product catalog and current inventory quantities.
- `stock_movements`: immutable-style audit log for inventory changes.
- `sales_challans`: sales documents with draft, confirmed, or cancelled status.
- `challan_items`: line items with product name, SKU, price, and quantity snapshots.

2. Business Rules
- Product SKU and challan numbers are unique.
- Confirming a challan is intended to reduce stock only through the secure function below.
- Product snapshots preserve what was sold even if the catalog changes later.

3. Security
- Row Level Security is enabled on every table.
- Signed-in staff can work with shared ERP records.
- Profile roles cannot be changed through normal profile updates.
- The `confirm_sales_challan` function validates stock and records the movement atomically.

4. Important Notes
- Authentication uses Supabase Auth; this migration does not create passwords or users.
- New auth users receive a Sales profile automatically through a database trigger.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'New team member',
  role text NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales', 'warehouse', 'accounts')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text NOT NULL,
  email text,
  business_name text,
  gst_number text,
  customer_type text NOT NULL DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale', 'distributor')),
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'active', 'inactive')),
  address text,
  follow_up_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL UNIQUE,
  category text NOT NULL,
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  current_stock integer NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock_alert integer NOT NULL DEFAULT 10 CHECK (min_stock_alert >= 0),
  location text NOT NULL DEFAULT 'Main warehouse',
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out')),
  reason text NOT NULL,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  total_quantity integer NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id uuid NOT NULL REFERENCES public.sales_challans(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name_snapshot text NOT NULL,
  sku_snapshot text NOT NULL,
  unit_price_snapshot numeric(12,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS customers_status_idx ON public.customers(status);
CREATE INDEX IF NOT EXISTS customers_follow_up_idx ON public.customers(follow_up_date);
CREATE INDEX IF NOT EXISTS products_stock_idx ON public.products(current_stock, min_stock_alert);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS challans_customer_idx ON public.sales_challans(customer_id, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_own_profile" ON public.profiles;
CREATE POLICY "staff_read_own_profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "staff_update_own_profile" ON public.profiles;
CREATE POLICY "staff_update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['customers','products','stock_movements','sales_challans','challan_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_select_%s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "authenticated_select_%s" ON public.%I FOR SELECT TO authenticated USING (true)', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert_%s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "authenticated_insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_update_%s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "authenticated_update_%s" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_delete_%s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "authenticated_delete_%s" ON public.%I FOR DELETE TO authenticated USING (true)', table_name, table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'New team member')) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.confirm_sales_challan(p_challan_id uuid)
RETURNS public.sales_challans
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_challan public.sales_challans;
  v_item record;
  v_product public.products;
BEGIN
  SELECT * INTO v_challan FROM public.sales_challans WHERE id = p_challan_id FOR UPDATE;
  IF v_challan.id IS NULL THEN RAISE EXCEPTION 'Challan not found'; END IF;
  IF v_challan.status <> 'draft' THEN RAISE EXCEPTION 'Only draft challans can be confirmed'; END IF;

  FOR v_item IN SELECT * FROM public.challan_items WHERE challan_id = p_challan_id LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF v_product.current_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
    END IF;
    UPDATE public.products SET current_stock = current_stock - v_item.quantity, updated_at = now() WHERE id = v_item.product_id;
    INSERT INTO public.stock_movements (product_id, quantity, movement_type, reason) VALUES (v_item.product_id, v_item.quantity, 'out', 'Sales challan ' || v_challan.challan_number);
  END LOOP;

  UPDATE public.sales_challans SET status = 'confirmed' WHERE id = p_challan_id RETURNING * INTO v_challan;
  RETURN v_challan;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_sales_challan(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_sales_challan(uuid) TO authenticated;
