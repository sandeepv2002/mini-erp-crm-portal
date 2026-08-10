-- ============================================================================
-- Complete Setup & Seed Script for Mini ERP + CRM (mini-erp-db)
-- Compatible with Neon.tech, Supabase, DBeaver, pgAdmin & PostgreSQL
-- ============================================================================

-- Step 1: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Create Tables

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Sales', 'Warehouse', 'Accounts')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table (CRM Module)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    business_name VARCHAR(255),
    gst_number VARCHAR(100),
    customer_type VARCHAR(50) NOT NULL CHECK (customer_type IN ('Retail', 'Wholesale', 'Distributor')),
    address TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Lead' CHECK (status IN ('Lead', 'Active', 'Inactive')),
    follow_up_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products Table (Inventory Module)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER NOT NULL DEFAULT 10,
    location VARCHAR(255) NOT NULL DEFAULT 'Main Warehouse',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Stock Movements Table (Inventory Audit Log)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
    reason VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Sales Challans Table (Sales Module)
CREATE TABLE IF NOT EXISTS sales_challans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Confirmed')),
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Challan Items Table (Product Snapshots)
CREATE TABLE IF NOT EXISTS challan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_id UUID NOT NULL REFERENCES sales_challans(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    product_snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_challans_customer_id ON sales_challans(customer_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_challan_id ON challan_items(challan_id);

-- Step 4: Clear existing data (Optional for fresh seed)
TRUNCATE TABLE challan_items, sales_challans, stock_movements, products, customers, users RESTART IDENTITY CASCADE;

-- Step 5: Seed Data

-- 1. SEED USERS (Admin, Sales, Warehouse, Accounts)
INSERT INTO users (id, email, password_hash, role) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@verveerp.com', '$2b$10$e8p.qW3G/8e2Xq4qX2qX2eX2qX2eX2qX2eX2qX2eX2qX2eX2qX2e', 'Admin'),
('22222222-2222-2222-2222-222222222222', 'sales@verveerp.com', '$2b$10$e8p.qW3G/8e2Xq4qX2qX2eX2qX2eX2qX2eX2qX2eX2qX2eX2qX2e', 'Sales'),
('33333333-3333-3333-3333-333333333333', 'warehouse@verveerp.com', '$2b$10$e8p.qW3G/8e2Xq4qX2qX2eX2qX2eX2qX2eX2qX2eX2qX2eX2qX2e', 'Warehouse'),
('44444444-4444-4444-4444-444444444444', 'accounts@verveerp.com', '$2b$10$e8p.qW3G/8e2Xq4qX2qX2eX2qX2eX2qX2eX2qX2eX2qX2eX2qX2e', 'Accounts')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash;

-- 2. SEED CUSTOMERS (CRM Module)
INSERT INTO customers (id, name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes) VALUES
('c1111111-1111-1111-1111-111111111111', 'Rajesh Kumar', '+91 98765 43210', 'rajesh@acme.com', 'Acme Enterprises', '29AAAAA0000A1Z5', 'Wholesale', 'Plot 42, Industrial Area, Phase 1, Bengaluru', 'Active', '2026-08-15', 'Interested in bulk purchasing copper fittings next month.'),
('c2222222-2222-2222-2222-222222222222', 'Anita Sharma', '+91 98123 45678', 'anita@apexretail.com', 'Apex Retailers', '29BBBCA1234B1Z2', 'Retail', '120 MG Road, Indiranagar, Bengaluru', 'Active', '2026-08-12', 'Needs updated pricing brochure for 2026 Q3.'),
('c3333333-3333-3333-3333-333333333333', 'Suresh Patel', '+91 97654 32109', 'suresh@globallogistics.in', 'Global Logistics Ltd', '29CCCDB5678C1Z8', 'Distributor', 'Building 8, Tech Park, Whitefield, Bengaluru', 'Lead', '2026-08-10', 'Initial discussion held. Scheduled follow-up demo call.'),
('c4444444-4444-4444-4444-444444444444', 'Vikram Singh', '+91 96543 21098', 'vikram@techcorp.com', 'TechCorp Solutions', '29DDDEE9012D1Z9', 'Wholesale', '45 Koramangala 4th Block, Bengaluru', 'Inactive', '2026-07-20', 'Account dormant since last quarter.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

-- 3. SEED PRODUCTS (Inventory Module)
INSERT INTO products (id, name, sku, category, unit_price, current_stock, min_stock_alert, location) VALUES
('p1111111-1111-1111-1111-111111111111', 'Industrial Valve 2-inch', 'VALV-001', 'Valves', 1250.00, 45, 10, 'Rack A-1'),
('p2222222-2222-2222-2222-222222222222', 'Copper Pipe 1/2-inch (6m)', 'PIPE-002', 'Plumbing', 450.00, 3, 15, 'Shelf B-2'),
('p3333333-3333-3333-3333-333333333333', 'Pressure Gauge 100 PSI', 'GAUGE-003', 'Instruments', 890.00, 2, 10, 'Rack A-3'),
('p4444444-4444-4444-4444-444444444444', 'Brass Coupler 3/4-inch', 'COUP-004', 'Fittings', 180.00, 120, 20, 'Shelf B-1'),
('p5555555-5555-5555-5555-555555555555', 'Stainless Steel Flange', 'FLNG-005', 'Fittings', 2100.00, 18, 5, 'Rack C-2')
ON CONFLICT (sku) DO UPDATE SET current_stock = EXCLUDED.current_stock, unit_price = EXCLUDED.unit_price;

-- 4. SEED STOCK MOVEMENTS (Inventory Audit Log)
INSERT INTO stock_movements (id, product_id, quantity, movement_type, reason, created_by, created_at) VALUES
('m1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 50, 'IN', 'Initial stock purchase order #PO-1001', '33333333-3333-3333-3333-333333333333', '2026-08-01 10:00:00'),
('m2222222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222', 20, 'IN', 'Initial stock purchase order #PO-1002', '33333333-3333-3333-3333-333333333333', '2026-08-01 10:30:00'),
('m3333333-3333-3333-3333-333333333333', 'p1111111-1111-1111-1111-111111111111', 5, 'OUT', 'Dispatched on Sales Challan #CHN-2026-001', '22222222-2222-2222-2222-222222222222', '2026-08-05 14:20:00'),
('m4444444-4444-4444-4444-444444444444', 'p2222222-2222-2222-2222-222222222222', 17, 'OUT', 'Dispatched on Sales Challan #CHN-2026-001', '22222222-2222-2222-2222-222222222222', '2026-08-05 14:20:00')
ON CONFLICT (id) DO NOTHING;

-- 5. SEED SALES CHALLANS (Sales Module)
INSERT INTO sales_challans (id, challan_number, customer_id, status, total_amount, created_by, created_at) VALUES
('ch111111-1111-1111-1111-111111111111', 'CHN-2026-001', 'c1111111-1111-1111-1111-111111111111', 'Confirmed', 13900.00, '22222222-2222-2222-2222-222222222222', '2026-08-05 14:20:00'),
('ch222222-2222-2222-2222-222222222222', 'CHN-2026-002', 'c2222222-2222-2222-2222-222222222222', 'Draft', 1800.00, '22222222-2222-2222-2222-222222222222', '2026-08-09 11:15:00')
ON CONFLICT (challan_number) DO NOTHING;

-- 6. SEED CHALLAN ITEMS (Product Snapshots)
INSERT INTO challan_items (id, challan_id, product_id, quantity, unit_price, total_price, product_snapshot, created_at) VALUES
('ci111111-1111-1111-1111-111111111111', 'ch111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 5, 1250.00, 6250.00, '{"name": "Industrial Valve 2-inch", "price": 1250.00, "sku": "VALV-001"}', '2026-08-05 14:20:00'),
('ci222222-2222-2222-2222-222222222222', 'ch111111-1111-1111-1111-111111111111', 'p2222222-2222-2222-2222-222222222222', 17, 450.00, 7650.00, '{"name": "Copper Pipe 1/2-inch (6m)", "price": 450.00, "sku": "PIPE-002"}', '2026-08-05 14:20:00'),
('ci333333-3333-3333-3333-333333333333', 'ch222222-2222-2222-2222-222222222222', 'p4444444-4444-4444-4444-444444444444', 10, 180.00, 1800.00, '{"name": "Brass Coupler 3/4-inch", "price": 180.00, "sku": "COUP-004"}', '2026-08-09 11:15:00')
ON CONFLICT (id) DO NOTHING;
