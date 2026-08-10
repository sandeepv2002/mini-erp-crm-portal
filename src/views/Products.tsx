import { useEffect, useState } from 'react';
import { Package, Plus, Search, Pencil, Trash2, X, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';
import { Card, PageHeader, Button, Input, Select, Badge, EmptyState } from '@/components/ui';

type Draft = Omit<Product, 'id' | 'created_by' | 'created_at' | 'updated_at'>;

const emptyDraft: Draft = {
  name: '',
  sku: '',
  category: '',
  unit_price: 0,
  current_stock: 0,
  min_stock_alert: 10,
  location: 'Main warehouse',
};

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%`);
    if (filterCategory !== 'all') q = q.eq('category', filterCategory);
    const { data, error } = await q.limit(100);
    if (error) {
      setError('Could not load products.');
      setProducts([]);
    } else {
      setProducts((data as Product[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [search, filterCategory]);

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  function openNew() {
    setEditing(null);
    setDraft(emptyDraft);
    setError(null);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setDraft({
      name: p.name, sku: p.sku, category: p.category, unit_price: p.unit_price,
      current_stock: p.current_stock, min_stock_alert: p.min_stock_alert, location: p.location,
    });
    setError(null);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...draft, unit_price: Number(draft.unit_price), current_stock: Number(draft.current_stock), min_stock_alert: Number(draft.min_stock_alert) };
    const { error } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id)
      : await supabase.from('products').insert(payload);
    if (error) {
      setError(error.code === '23505' ? 'That SKU already exists.' : 'Could not save the product. Please try again.');
      setSaving(false);
      return;
    }
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function remove(p: Product) {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) {
      alert('Could not delete this product — it may be referenced by challans or stock movements.');
      return;
    }
    load();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Products"
        subtitle="Manage your catalog and current inventory levels."
        action={<Button onClick={openNew}><Plus size={16} /> New product</Button>}
      />

      <Card className="p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-ink-200 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition"
            />
          </div>
          <Select
            value={filterCategory}
            onChange={setFilterCategory}
            options={categories.map((c) => ({ value: c, label: c === 'all' ? 'All categories' : c }))}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" size={24} /></div>
        ) : products.length === 0 ? (
          <EmptyState title="No products found" subtitle="Add your first product to start tracking inventory." icon={<Package size={28} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 border-b border-ink-200 bg-ink-50/50">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium text-right">Price</th>
                  <th className="px-5 py-3 font-medium text-right">Stock</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const low = p.current_stock <= p.min_stock_alert;
                  return (
                    <tr key={p.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50 transition">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink-900">{p.name}</p>
                        <p className="text-xs text-ink-500">{p.location}</p>
                      </td>
                      <td className="px-5 py-3.5"><span className="font-mono text-xs text-ink-600">{p.sku}</span></td>
                      <td className="px-5 py-3.5 text-ink-600">{p.category || '—'}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink-900">₹{Number(p.unit_price).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3.5 text-right">
                        {low ? (
                          <Badge tone="red"><AlertTriangle size={12} /> {p.current_stock} left</Badge>
                        ) : (
                          <span className="font-medium text-ink-900">{p.current_stock}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition"><Pencil size={16} /></button>
                          <button onClick={() => remove(p)} className="p-2 rounded-lg text-ink-500 hover:bg-red-50 hover:text-danger-600 transition"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink-900/40 backdrop-blur-sm">
          <Card className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto animate-slide-in sm:animate-fade-in rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-display font-semibold text-ink-900">{editing ? 'Edit product' : 'New product'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-ink-100"><X size={18} className="text-ink-500" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <Input label="Product name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} required placeholder="Cotton T-shirt" />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="SKU" value={draft.sku} onChange={(v) => setDraft({ ...draft, sku: v.toUpperCase() })} required placeholder="TSHIRT-RED-M" />
                <Input label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} placeholder="Apparel" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Unit price (₹)" value={String(draft.unit_price)} onChange={(v) => setDraft({ ...draft, unit_price: Number(v) })} type="number" required />
                <Input label="Current stock" value={String(draft.current_stock)} onChange={(v) => setDraft({ ...draft, current_stock: Number(v) })} type="number" required />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Minimum stock alert" value={String(draft.min_stock_alert)} onChange={(v) => setDraft({ ...draft, min_stock_alert: Number(v) })} type="number" required />
                <Input label="Location" value={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} placeholder="Main warehouse" />
              </div>
              {error && <div className="text-sm text-danger-600 bg-danger-500/5 border border-danger-500/20 rounded-xl px-3.5 py-2.5">{error}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : null}{editing ? 'Save changes' : 'Add product'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
