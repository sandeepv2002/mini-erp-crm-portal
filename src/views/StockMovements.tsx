import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Plus, X, Loader2, ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StockMovement, MovementType, Product } from '@/lib/supabase';
import { Card, PageHeader, Button, Input, Select, EmptyState } from '@/components/ui';

export function StockMovementsView() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [movementType, setMovementType] = useState<MovementType>('in');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [mv, pr] = await Promise.all([
      supabase
        .from('stock_movements')
        .select('id, product_id, quantity, movement_type, reason, created_by, created_at, product:products(name, sku)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('products').select('id, name, sku, current_stock').order('name', { ascending: true }),
    ]);
    setMovements((mv.data as unknown as StockMovement[]) ?? []);
    setProducts((pr.data as unknown as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const qty = Number(quantity);
    if (!productId || !qty || qty < 1) {
      setError('Choose a product and enter a quantity greater than zero.');
      setSaving(false);
      return;
    }
    if (!reason.trim()) {
      setError('Add a reason for this movement.');
      setSaving(false);
      return;
    }

    const product = products.find((p) => p.id === productId);
    if (movementType === 'out' && product && qty > product.current_stock) {
      setError(`Only ${product.current_stock} units of ${product.name} are in stock.`);
      setSaving(false);
      return;
    }

    const { error: mvError } = await supabase.from('stock_movements').insert({
      product_id: productId,
      quantity: qty,
      movement_type: movementType,
      reason: reason.trim(),
    });
    if (mvError) {
      setError('Could not record the movement. Please try again.');
      setSaving(false);
      return;
    }

    const newStock = movementType === 'in' ? product!.current_stock + qty : product!.current_stock - qty;
    await supabase.from('products').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', productId);

    setShowForm(false);
    setProductId('');
    setQuantity('1');
    setReason('');
    setMovementType('in');
    setSaving(false);
    load();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Stock Movements"
        subtitle="A strict log of every inventory change, with reason and timestamp."
        action={<Button onClick={() => setShowForm(true)}><Plus size={16} /> Record movement</Button>}
      />

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" size={24} /></div>
        ) : movements.length === 0 ? (
          <EmptyState title="No movements yet" subtitle="Record stock coming in or going out." icon={<ArrowLeftRight size={28} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 border-b border-ink-200 bg-ink-50/50">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium text-right">Qty</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink-900">{m.product?.name ?? '—'}</p>
                      <p className="text-xs text-ink-500 font-mono">{m.product?.sku ?? ''}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {m.movement_type === 'in' ? (
                        <span className="inline-flex items-center gap-1 text-brand-600 font-medium"><ArrowUpRight size={14} /> In</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-danger-600 font-medium"><ArrowDownRight size={14} /> Out</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-ink-900">{m.quantity}</td>
                    <td className="px-5 py-3.5 text-ink-600">{m.reason}</td>
                    <td className="px-5 py-3.5 text-ink-500 text-xs">{new Date(m.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink-900/40 backdrop-blur-sm">
          <Card className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-slide-in sm:animate-fade-in rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-display font-semibold text-ink-900">Record stock movement</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-ink-100"><X size={18} className="text-ink-500" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <Select label="Product" value={productId} onChange={setProductId} required options={[{ value: '', label: 'Select a product…' }, ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku}) — ${p.current_stock} in stock` }))]} />
              <Select label="Movement type" value={movementType} onChange={(v) => setMovementType(v as MovementType)} options={[{ value: 'in', label: 'Stock in (purchase, return)' }, { value: 'out', label: 'Stock out (damage, adjustment)' }]} />
              <Input label="Quantity" value={quantity} onChange={setQuantity} type="number" required />
              <Input label="Reason" value={reason} onChange={setReason} placeholder="New purchase, damaged goods, stock correction…" required />
              {error && <div className="text-sm text-danger-600 bg-danger-500/5 border border-danger-500/20 rounded-xl px-3.5 py-2.5">{error}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : null}Record movement</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
