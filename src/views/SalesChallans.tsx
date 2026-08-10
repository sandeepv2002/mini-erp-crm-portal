import { useEffect, useState } from 'react';
import { ClipboardList, Plus, X, Loader2, Trash2, CheckCircle2, Eye, Package, Download, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SalesChallan, ChallanItem, Customer, Product, ChallanStatus } from '@/lib/supabase';
import { Card, PageHeader, Button, Select, Badge, EmptyState, Input } from '@/components/ui';
import { downloadChallanPDF } from '@/lib/apiClient';


type LineItem = {
  product_id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
};

const statusTone: Record<ChallanStatus, 'neutral' | 'brand' | 'red'> = {
  draft: 'neutral',
  confirmed: 'brand',
  cancelled: 'red',
};

export function SalesChallansView() {
  const [challans, setChallans] = useState<SalesChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<SalesChallan | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_challans')
      .select('id, challan_number, customer_id, status, total_quantity, total_amount, created_by, created_at, customer:customers(name, mobile)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setChallans([]);
    } else {
      setChallans((data as unknown as SalesChallan[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openNew() {
    setError(null);
    const [c, p] = await Promise.all([
      supabase.from('customers').select('id, name, mobile').order('name', { ascending: true }).limit(200),
      supabase.from('products').select('id, name, sku, unit_price, current_stock').order('name', { ascending: true }).limit(200),
    ]);
    setCustomers((c.data as unknown as Customer[]) ?? []);
    setProducts((p.data as unknown as Product[]) ?? []);
    setCustomerId('');
    setItems([]);
    setShowForm(true);
  }

  function addLine(productId: string) {
    if (!productId) return;
    if (items.some((i) => i.product_id === productId)) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setItems([
      ...items,
      {
        product_id: product.id,
        product_name_snapshot: product.name,
        sku_snapshot: product.sku,
        unit_price_snapshot: Number(product.unit_price),
        quantity: 1,
        line_total: Number(product.unit_price),
      },
    ]);
  }

  function updateLine(idx: number, field: 'quantity' | 'unit_price_snapshot', value: number) {
    const next = [...items];
    const item = next[idx];
    const v = Math.max(0, value);
    if (field === 'quantity') item.quantity = Math.floor(v);
    if (field === 'unit_price_snapshot') item.unit_price_snapshot = v;
    item.line_total = Number((item.unit_price_snapshot * item.quantity).toFixed(2));
    setItems(next);
  }

  function removeLine(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmt = items.reduce((s, i) => s + i.line_total, 0);

  async function save(status: 'draft' | 'confirmed') {
    setSaving(true);
    setError(null);
    if (!customerId) { setError('Select a customer.'); setSaving(false); return; }
    if (items.length === 0) { setError('Add at least one product.'); setSaving(false); return; }
    for (const it of items) {
      if (!it.quantity || it.quantity < 1) { setError('Every line needs a quantity of at least 1.'); setSaving(false); return; }
    }

    const seq = String(Date.now()).slice(-6);
    const challanNumber = `CHN-${new Date().getFullYear()}-${seq}`;

    const { data: challan, error: chError } = await supabase
      .from('sales_challans')
      .insert({
        challan_number: challanNumber,
        customer_id: customerId,
        status: 'draft',
        total_quantity: totalQty,
        total_amount: totalAmt,
      })
      .select('id, challan_number, customer_id, status, total_quantity, total_amount, created_by, created_at')
      .single();

    if (chError || !challan) {
      setError('Could not create the challan. Please try again.');
      setSaving(false);
      return;
    }

    const { error: itemsError } = await supabase.from('challan_items').insert(
      items.map((it) => ({
        challan_id: challan.id,
        product_id: it.product_id,
        product_name_snapshot: it.product_name_snapshot,
        sku_snapshot: it.sku_snapshot,
        unit_price_snapshot: it.unit_price_snapshot,
        quantity: it.quantity,
        line_total: it.line_total,
      }))
    );

    if (itemsError) {
      await supabase.from('sales_challans').delete().eq('id', challan.id);
      setError('Could not save the challan items. Please try again.');
      setSaving(false);
      return;
    }

    if (status === 'confirmed') {
      const { error: confirmError } = await supabase.rpc('confirm_sales_challan', { p_challan_id: challan.id });
      if (confirmError) {
        setError(confirmError.message?.replace(/^ERROR:\s*/, '') || 'Insufficient stock to confirm this challan.');
        setSaving(false);
        return;
      }
    }

    setShowForm(false);
    setSaving(false);
    load();
  }

  async function confirmExisting(ch: SalesChallan) {
    setConfirmingId(ch.id);
    setError(null);
    const { error } = await supabase.rpc('confirm_sales_challan', { p_challan_id: ch.id });
    if (error) {
      alert(error.message?.replace(/^ERROR:\s/, '') || 'Could not confirm this challan.');
    }
    setConfirmingId(null);
    load();
  }

  async function cancelExisting(ch: SalesChallan) {
    if (!confirm(`Cancel ${ch.challan_number}?`)) return;
    await supabase.from('sales_challans').update({ status: 'cancelled' }).eq('id', ch.id);
    load();
  }

  async function viewDetails(ch: SalesChallan) {
    const { data } = await supabase
      .from('challan_items')
      .select('id, challan_id, product_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity, line_total')
      .eq('challan_id', ch.id);
    setViewing({ ...ch, challan_items: (data as unknown as ChallanItem[]) ?? [] });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sales Challans"
        subtitle="Create delivery challans. Confirming a challan automatically reduces stock."
        action={<Button onClick={openNew}><Plus size={16} /> New challan</Button>}
      />

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" size={24} /></div>
        ) : challans.length === 0 ? (
          <EmptyState title="No challans yet" subtitle="Create your first sales challan to deliver products." icon={<ClipboardList size={28} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 border-b border-ink-200 bg-ink-50/50">
                  <th className="px-5 py-3 font-medium">Challan no.</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium text-right">Qty</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {challans.map((ch) => (
                  <tr key={ch.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50 transition">
                    <td className="px-5 py-3.5 font-medium text-ink-900">{ch.challan_number}</td>
                    <td className="px-5 py-3.5 text-ink-700">{ch.customer?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right text-ink-700">{ch.total_quantity}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-ink-900">₹{Number(ch.total_amount).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3.5"><Badge tone={statusTone[ch.status]}>{ch.status}</Badge></td>
                    <td className="px-5 py-3.5 text-ink-500 text-xs">{new Date(ch.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => viewDetails(ch)} className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition" title="View"><Eye size={16} /></button>
                        <button onClick={() => downloadChallanPDF(ch.id, ch.challan_number)} className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 transition" title="Export PDF Invoice"><Download size={16} /></button>
                        {ch.status === 'draft' && (
                          <>
                            <button
                              onClick={() => confirmExisting(ch)}
                              disabled={confirmingId === ch.id}
                              className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 transition disabled:opacity-50"
                              title="Confirm and reduce stock"
                            >
                              {confirmingId === ch.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            </button>
                            <button onClick={() => cancelExisting(ch)} className="p-2 rounded-lg text-ink-500 hover:bg-red-50 hover:text-danger-600 transition" title="Cancel"><X size={16} /></button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New challan drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink-900/40 backdrop-blur-sm">
          <Card className="w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto animate-slide-in sm:animate-fade-in rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="font-display font-semibold text-ink-900">New sales challan</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-ink-100"><X size={18} className="text-ink-500" /></button>
            </div>
            <div className="p-6 space-y-5">
              <Select label="Customer" value={customerId} onChange={setCustomerId} required options={[{ value: '', label: 'Select a customer…' }, ...customers.map((c) => ({ value: c.id, label: `${c.name} — ${c.mobile}` }))]} />

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Add product</label>
                <Select
                  value=""
                  onChange={(v) => { addLine(v); }}
                  options={[{ value: '', label: 'Select a product to add…' }, ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku}) — ₹${p.unit_price} — ${p.current_stock} in stock` }))]}
                />
              </div>

              {items.length > 0 ? (
                <div className="border border-ink-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-50/50 text-ink-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Product</th>
                        <th className="px-3 py-2 text-right font-medium">Price</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={idx} className="border-t border-ink-100">
                          <td className="px-3 py-2">
                            <p className="font-medium text-ink-900">{it.product_name_snapshot}</p>
                            <p className="text-xs text-ink-500 font-mono">{it.sku_snapshot}</p>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={it.unit_price_snapshot}
                              onChange={(e) => updateLine(idx, 'unit_price_snapshot', Number(e.target.value))}
                              className="w-20 px-2 py-1 text-right rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-300"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={it.quantity}
                              min={1}
                              onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                              className="w-16 px-2 py-1 text-right rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-300"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-ink-900">₹{it.line_total.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => removeLine(idx)} className="p-1.5 rounded-lg text-ink-400 hover:bg-red-50 hover:text-danger-600 transition"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-ink-50/50">
                      <tr>
                        <td className="px-3 py-2.5 font-medium text-ink-700" colSpan={2}>Totals</td>
                        <td className="px-3 py-2.5 text-right font-medium text-ink-900">{totalQty}</td>
                        <td className="px-3 py-2.5 text-right font-display font-bold text-ink-900">₹{totalAmt.toLocaleString('en-IN')}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-ink-400 text-sm border border-dashed border-ink-200 rounded-xl">
                  <Package size={20} className="mx-auto mb-2 text-ink-300" />
                  Add products to this challan
                </div>
              )}

              {error && <div className="text-sm text-danger-600 bg-danger-500/5 border border-danger-500/20 rounded-xl px-3.5 py-2.5">{error}</div>}

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 sticky bottom-0 bg-white pb-1">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="button" variant="secondary" disabled={saving || items.length === 0} onClick={() => save('draft')}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null} Save as draft
                </Button>
                <Button type="button" disabled={saving || items.length === 0} onClick={() => save('confirmed')}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Confirm & reduce stock
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* View challan modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink-900/40 backdrop-blur-sm">
          <Card className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto animate-slide-in sm:animate-fade-in rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h2 className="font-display font-semibold text-ink-900">{viewing.challan_number}</h2>
                <p className="text-xs text-ink-500">{viewing.customer?.name} · {new Date(viewing.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[viewing.status]}>{viewing.status}</Badge>
                <button onClick={() => setViewing(null)} className="p-1.5 rounded-lg hover:bg-ink-100"><X size={18} className="text-ink-500" /></button>
              </div>
            </div>
            <div className="p-6">
              {viewing.challan_items && viewing.challan_items.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="text-ink-500">
                    <tr className="border-b border-ink-200">
                      <th className="py-2 text-left font-medium">Product</th>
                      <th className="py-2 text-right font-medium">Price</th>
                      <th className="py-2 text-right font-medium">Qty</th>
                      <th className="py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.challan_items.map((it) => (
                      <tr key={it.id} className="border-b border-ink-100 last:border-0">
                        <td className="py-2.5">
                          <p className="font-medium text-ink-900">{it.product_name_snapshot}</p>
                          <p className="text-xs text-ink-500 font-mono">{it.sku_snapshot}</p>
                        </td>
                        <td className="py-2.5 text-right text-ink-700">₹{Number(it.unit_price_snapshot).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right text-ink-700">{it.quantity}</td>
                        <td className="py-2.5 text-right font-medium text-ink-900">₹{Number(it.line_total).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink-50/50">
                      <td className="px-3 py-2.5 font-medium text-ink-700" colSpan={2}>Totals</td>
                      <td className="px-3 py-2.5 text-right font-medium text-ink-900">{viewing.total_quantity}</td>
                      <td className="px-3 py-2.5 text-right font-display font-bold text-ink-900">₹{Number(viewing.total_amount).toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="text-ink-400 text-sm text-center py-6">No items on this challan.</p>
              )}
              <div className="flex gap-3 mt-5">
                <Button variant="secondary" className="flex-1" onClick={() => downloadChallanPDF(viewing.id, viewing.challan_number)}>
                  <Download size={16} /> Download PDF Invoice
                </Button>
                {viewing.status === 'draft' && (
                  <Button className="flex-1" onClick={() => { confirmExisting(viewing); setViewing(null); }}>
                    <CheckCircle2 size={16} /> Confirm & reduce stock
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

}
