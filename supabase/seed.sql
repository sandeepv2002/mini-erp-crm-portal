-- =========================================================
-- Seed & Schema Data for Mini ERP + CRM Portal
-- Compatible with Supabase verve-erp project
-- =========================================================

-- Clear existing records for a fresh dataset (Optional)
TRUNCATE TABLE public.challan_items, public.sales_challans, public.stock_movements, public.products, public.customers RESTART IDENTITY CASCADE;

-- 1. SEED CUSTOMERS (CRM Module)
INSERT INTO public.customers (id, name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes) VALUES
('c1111111-1111-1111-1111-111111111111', 'Rajesh Kumar', '+91 98765 43210', 'rajesh@acme.com', 'Acme Enterprises', '29AAAAA0000A1Z5', 'wholesale', 'Plot 42, Industrial Area, Phase 1, Bengaluru', 'active', '2026-08-15', 'Interested in bulk purchasing copper fittings next month.'),
('c2222222-2222-2222-2222-222222222222', 'Anita Sharma', '+91 98123 45678', 'anita@apexretail.com', 'Apex Retailers', '29BBBCA1234B1Z2', 'retail', '120 MG Road, Indiranagar, Bengaluru', 'active', '2026-08-12', 'Needs updated pricing brochure for 2026 Q3.'),
('c3333333-3333-3333-3333-333333333333', 'Suresh Patel', '+91 97654 32109', 'suresh@globallogistics.in', 'Global Logistics Ltd', '29CCCDB5678C1Z8', 'distributor', 'Building 8, Tech Park, Whitefield, Bengaluru', 'lead', '2026-08-10', 'Initial discussion held. Scheduled follow-up demo call.'),
('c4444444-4444-4444-4444-444444444444', 'Vikram Singh', '+91 96543 21098', 'vikram@techcorp.com', 'TechCorp Solutions', '29DDDEE9012D1Z9', 'wholesale', '45 Koramangala 4th Block, Bengaluru', 'inactive', '2026-07-20', 'Account dormant since last quarter.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

-- 2. SEED CUSTOMER FOLLOW-UP NOTES
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note text NOT NULL,
  author_name text NOT NULL DEFAULT 'Staff Member',
  author_role text NOT NULL DEFAULT 'sales',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.customer_notes (customer_id, note, author_name, author_role) VALUES
('c1111111-1111-1111-1111-111111111111', 'Initial phone discussion held. Customer requested wholesale price list for Q3.', 'Sales Representative', 'sales'),
('c1111111-1111-1111-1111-111111111111', 'Interested in bulk purchasing copper fittings next month.', 'Sales Representative', 'sales'),
('c3333333-3333-3333-3333-333333333333', 'Initial discussion held. Scheduled follow-up demo call.', 'Sales Representative', 'sales')
ON CONFLICT DO NOTHING;

-- 3. SEED PRODUCTS (Inventory Module)
-- Note: UUIDs use only valid hex characters (0-9, a-f)
INSERT INTO public.products (id, name, sku, category, unit_price, current_stock, min_stock_alert, location) VALUES
('a1111111-1111-1111-1111-111111111111', 'Industrial Valve 2-inch', 'VALV-001', 'Valves', 1250.00, 45, 10, 'Rack A-1'),
('b2222222-2222-2222-2222-222222222222', 'Copper Pipe half-inch 6m', 'PIPE-002', 'Plumbing', 450.00, 3, 15, 'Shelf B-2'),
('a3333333-3333-3333-3333-333333333333', 'Pressure Gauge 100 PSI', 'GAUGE-003', 'Instruments', 890.00, 2, 10, 'Rack A-3'),
('b4444444-4444-4444-4444-444444444444', 'Brass Coupler 3/4-inch', 'COUP-004', 'Fittings', 180.00, 120, 20, 'Shelf B-1'),
('a5555555-5555-5555-5555-555555555555', 'Stainless Steel Flange', 'FLNG-005', 'Fittings', 2100.00, 18, 5, 'Rack C-2')
ON CONFLICT (sku) DO UPDATE SET current_stock = EXCLUDED.current_stock, unit_price = EXCLUDED.unit_price;

-- 4. SEED STOCK MOVEMENTS (Inventory Audit Log)
INSERT INTO public.stock_movements (id, product_id, quantity, movement_type, reason, created_at) VALUES
('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 50, 'in', 'Initial stock purchase order #PO-1001', '2026-08-01 10:00:00+00'),
('e2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 20, 'in', 'Initial stock purchase order #PO-1002', '2026-08-01 10:30:00+00'),
('e3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 5, 'out', 'Dispatched on Sales Challan #CHN-2026-001', '2026-08-05 14:20:00+00'),
('e4444444-4444-4444-4444-444444444444', 'b2222222-2222-2222-2222-222222222222', 17, 'out', 'Dispatched on Sales Challan #CHN-2026-001', '2026-08-05 14:20:00+00')
ON CONFLICT (id) DO NOTHING;

-- 5. SEED SALES CHALLANS (Sales Module)
INSERT INTO public.sales_challans (id, challan_number, customer_id, total_quantity, total_amount, status, created_at) VALUES
('cc111111-1111-1111-1111-111111111111', 'CHN-2026-001', 'c1111111-1111-1111-1111-111111111111', 22, 13900.00, 'confirmed', '2026-08-05 14:20:00+00'),
('cc222222-2222-2222-2222-222222222222', 'CHN-2026-002', 'c2222222-2222-2222-2222-222222222222', 10, 1800.00, 'draft', '2026-08-09 11:15:00+00')
ON CONFLICT (id) DO NOTHING;

-- 6. SEED CHALLAN ITEMS (Product Snapshots)
INSERT INTO public.challan_items (challan_id, product_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity, line_total) VALUES
('cc111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Industrial Valve 2-inch', 'VALV-001', 1250.00, 5, 6250.00),
('cc111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'Copper Pipe half-inch 6m', 'PIPE-002', 450.00, 17, 7650.00),
('cc222222-2222-2222-2222-222222222222', 'b4444444-4444-4444-4444-444444444444', 'Brass Coupler 3/4-inch', 'COUP-004', 180.00, 10, 1800.00)
ON CONFLICT DO NOTHING;
