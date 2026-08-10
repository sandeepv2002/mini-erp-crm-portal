import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Role = 'admin' | 'sales' | 'warehouse' | 'accounts';

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
};

export type CustomerType = 'retail' | 'wholesale' | 'distributor';
export type CustomerStatus = 'lead' | 'active' | 'inactive';

export type Customer = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  business_name: string | null;
  gst_number: string | null;
  customer_type: CustomerType;
  status: CustomerStatus;
  address: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit_price: number;
  current_stock: number;
  min_stock_alert: number;
  location: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MovementType = 'in' | 'out';

export type StockMovement = {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: MovementType;
  reason: string;
  created_by: string | null;
  created_at: string;
  product?: Pick<Product, 'name' | 'sku'>;
};

export type ChallanStatus = 'draft' | 'confirmed' | 'cancelled';

export type ChallanItem = {
  id: string;
  challan_id: string;
  product_id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
};

export type SalesChallan = {
  id: string;
  challan_number: string;
  customer_id: string;
  status: ChallanStatus;
  total_quantity: number;
  total_amount: number;
  created_by: string | null;
  created_at: string;
  customer?: Pick<Customer, 'name' | 'mobile'>;
  challan_items?: ChallanItem[];
};
