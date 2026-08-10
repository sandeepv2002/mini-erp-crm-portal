-- =========================================================
-- Seed & Schema Enhancements for Mini ERP + CRM Portal
-- =========================================================

-- Create customer_notes table for dedicated follow-up notes history log
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note text NOT NULL,
  author_name text NOT NULL DEFAULT 'Staff Member',
  author_role text NOT NULL DEFAULT 'sales',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_customer_notes" ON public.customer_notes;
CREATE POLICY "authenticated_select_customer_notes" ON public.customer_notes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_customer_notes" ON public.customer_notes;
CREATE POLICY "authenticated_insert_customer_notes" ON public.customer_notes FOR INSERT TO authenticated WITH CHECK (true);

-- Insert Sample Customers
INSERT INTO public.customers (id, name, mobile, email, business_name, gst_number, customer_type, status, address, follow_up_date, notes)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Rahul Sharma', '9876543210', 'rahul@sharmatraders.in', 'Sharma Traders', '07AAAAA0000A1Z5', 'wholesale', 'active', '45 Commercial Street, New Delhi', '2026-08-15', 'Interested in bulk apparel discount for festive season.'),
  ('c2222222-2222-2222-2222-222222222222', 'Priya Patel', '9812345678', 'priya@patelretail.com', 'Patel Retail Store', '24BBBBB1111B2Z3', 'retail', 'lead', '12 Station Road, Ahmedabad', '2026-08-12', 'Followed up regarding catalog sample delivery.'),
  ('c3333333-3333-3333-3333-333333333333', 'Apex Logistics & Wholesale', '9700011223', 'contact@apexlogistics.co.in', 'Apex Logistics Ltd', '27CCCCC2222C3Z1', 'distributor', 'active', '88 Logistics Hub, Mumbai', '2026-08-20', 'Key distributor account for West Zone.')
ON CONFLICT (id) DO NOTHING;

-- Insert Sample Follow-up Notes for Customer 1
INSERT INTO public.customer_notes (customer_id, note, author_name, author_role)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Initial phone discussion held. Customer requested wholesale price list for Q3.', 'Sales Rep', 'sales'),
  ('c1111111-1111-1111-1111-111111111111', 'Sent product catalog PDF. Scheduled follow-up call for next Tuesday.', 'Sales Rep', 'sales')
ON CONFLICT DO NOTHING;

-- Insert Sample Products
INSERT INTO public.products (id, name, sku, category, unit_price, current_stock, min_stock_alert, location)
VALUES
  ('p1111111-1111-1111-1111-111111111111', 'Premium Cotton T-Shirt (Navy Blue)', 'TSHIRT-NVY-L', 'Apparel', 499.00, 150, 20, 'Warehouse A - Bay 4'),
  ('p2222222-2222-2222-2222-222222222222', 'Slim Fit Denim Jeans (32)', 'JEANS-SLM-32', 'Apparel', 1299.00, 8, 15, 'Warehouse A - Bay 7'),
  ('p3333333-3333-3333-3333-333333333333', 'Wireless Ergonomic Keyboard', 'KB-WRLSS-01', 'Electronics', 1899.00, 45, 10, 'Warehouse B - Shelf 2'),
  ('p4444444-4444-4444-4444-444444444444', 'Stainless Steel Water Bottle (1L)', 'BTL-SS-1000', 'Accessories', 350.00, 5, 25, 'Warehouse B - Shelf 9')
ON CONFLICT (id) DO NOTHING;
