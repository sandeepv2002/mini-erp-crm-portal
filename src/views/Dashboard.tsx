import { useEffect, useState } from 'react';
import { Users, Package, ClipboardList, AlertTriangle, TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, PageHeader, Badge, EmptyState } from '@/components/ui';
import type { Product, SalesChallan } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function Dashboard({ onNavigate }: { onNavigate: (v: 'customers' | 'products' | 'challans' | 'movements') => void }) {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ customers: 0, products: 0, challans: 0, lowStock: 0 });
  const [recentChallans, setRecentChallans] = useState<SalesChallan[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, p, ch, low, recent] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('sales_challans').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id, name, sku, current_stock, min_stock_alert').lt('current_stock', 0).limit(5),
        supabase
          .from('sales_challans')
          .select('id, challan_number, status, total_amount, total_quantity, created_at, customer:customers(name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const { count: lowCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .filter('current_stock', 'lt', 'min_stock_alert');

      setStats({
        customers: c.count ?? 0,
        products: p.count ?? 0,
        challans: ch.count ?? 0,
        lowStock: lowCount ?? 0,
      });
      setLowStockItems((low.data as unknown as Product[]) ?? []);
      setRecentChallans((recent.data as unknown as SalesChallan[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: 'Customers', value: stats.customers, icon: Users, tone: 'brand', view: 'customers' as const },
    { label: 'Products', value: stats.products, icon: Package, tone: 'blue', view: 'products' as const },
    { label: 'Sales Challans', value: stats.challans, icon: ClipboardList, tone: 'amber', view: 'challans' as const },
    { label: 'Low Stock Alerts', value: stats.lowStock, icon: AlertTriangle, tone: 'red', view: 'products' as const },
  ];

  const tones: Record<string, string> = {
    brand: 'bg-brand-100 text-brand-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] ?? 'team'}`}
        subtitle="Here is what is happening across your operations today."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => onNavigate(c.view)}
              className="text-left bg-white rounded-2xl border border-ink-200/70 shadow-soft p-5 hover:shadow-card hover:border-ink-300 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[c.tone]}`}>
                  <Icon size={20} />
                </div>
                <ArrowUpRight size={16} className="text-ink-300 group-hover:text-ink-500 transition" />
              </div>
              <p className="text-3xl font-display font-bold text-ink-900 mt-3">{loading ? '—' : c.value}</p>
              <p className="text-sm text-ink-500 mt-0.5">{c.label}</p>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
              <Clock size={18} className="text-ink-400" /> Recent Challans
            </h3>
            <button onClick={() => onNavigate('challans')} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              View all
            </button>
          </div>
          {recentChallans.length === 0 ? (
            <EmptyState title="No challans yet" subtitle="Create your first sales challan." icon={<ClipboardList size={28} />} />
          ) : (
            <div className="space-y-2">
              {recentChallans.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between py-2.5 border-b border-ink-100 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 text-sm truncate">{ch.challan_number}</p>
                    <p className="text-xs text-ink-500 truncate">{ch.customer?.name ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-ink-900">₹{Number(ch.total_amount).toLocaleString('en-IN')}</span>
                    <Badge tone={ch.status === 'confirmed' ? 'brand' : ch.status === 'cancelled' ? 'red' : 'neutral'}>
                      {ch.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-ink-400" /> Low Stock Watch
            </h3>
            <button onClick={() => onNavigate('products')} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Manage
            </button>
          </div>
          {lowStockItems.length === 0 ? (
            <EmptyState title="All stock levels healthy" subtitle="No products below their alert threshold." icon={<Package size={28} />} />
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-ink-100 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-ink-500">{p.sku}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ArrowDownRight size={14} className="text-danger-500" />
                    <span className="text-sm font-semibold text-danger-600">{p.current_stock} left</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
