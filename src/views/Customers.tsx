import { useEffect, useState } from 'react';
import { Users, Plus, Search, Pencil, Trash2, X, Loader2, Phone, Mail, MapPin, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Customer, CustomerType, CustomerStatus } from '@/lib/supabase';
import { Card, PageHeader, Button, Input, Select, Textarea, Badge, EmptyState } from '@/components/ui';

const typeOptions = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'distributor', label: 'Distributor' },
];

const statusOptions = [
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const statusTone: Record<CustomerStatus, 'amber' | 'brand' | 'neutral'> = {
  lead: 'amber',
  active: 'brand',
  inactive: 'neutral',
};

const typeTone: Record<CustomerType, 'blue' | 'brand' | 'amber'> = {
  retail: 'blue',
  wholesale: 'brand',
  distributor: 'amber',
};

type Draft = {
  name: string;
  mobile: string;
  email: string;
  business_name: string;
  gst_number: string;
  customer_type: CustomerType;
  status: CustomerStatus;
  address: string;
  follow_up_date: string;
  notes: string;
};

const emptyDraft: Draft = {
  name: '',
  mobile: '',
  email: '',
  business_name: '',
  gst_number: '',
  customer_type: 'retail',
  status: 'lead',
  address: '',
  follow_up_date: '',
  notes: '',
};

export function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,mobile.ilike.%${search.trim()}%,business_name.ilike.%${search.trim()}%`);
    if (filterType !== 'all') q = q.eq('customer_type', filterType);
    if (filterStatus !== 'all') q = q.eq('status', filterStatus);
    const { data, error } = await q.limit(100);
    if (error) {
      setError('Could not load customers.');
      setCustomers([]);
    } else {
      setCustomers((data as unknown as Customer[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [search, filterType, filterStatus]);

  function openNew() {
    setEditing(null);
    setDraft(emptyDraft);
    setError(null);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setDraft({
      name: c.name, mobile: c.mobile, email: c.email ?? '', business_name: c.business_name ?? '',
      gst_number: c.gst_number ?? '', customer_type: c.customer_type, status: c.status,
      address: c.address ?? '', follow_up_date: c.follow_up_date ?? '', notes: c.notes ?? '',
    });
    setError(null);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...draft,
      email: draft.email || null,
      business_name: draft.business_name || null,
      gst_number: draft.gst_number || null,
      address: draft.address || null,
      follow_up_date: draft.follow_up_date || null,
      notes: draft.notes || null,
    };
    const { error } = editing
      ? await supabase.from('customers').update(payload).eq('id', editing.id)
      : await supabase.from('customers').insert(payload);
    if (error) {
      setError('Could not save the customer. Please try again.');
      setSaving(false);
      return;
    }
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function remove(c: Customer) {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    await supabase.from('customers').delete().eq('id', c.id);
    load();
  }

  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [notesList, setNotesList] = useState<Array<{ id: string; note: string; author_name?: string; author_role?: string; created_at: string }>>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  async function openDetail(c: Customer) {
    setDetailCustomer(c);
    setNotesList([]);
    setNewNote('');
    // Load follow-up notes from database
    const { data } = await supabase.from('customer_notes').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setNotesList(data as any);
    } else if (c.notes) {
      setNotesList([{ id: 'default-1', note: c.notes, author_name: 'System Log', created_at: c.created_at }]);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim() || !detailCustomer) return;
    setAddingNote(true);

    const { data, error } = await supabase.from('customer_notes').insert({
      customer_id: detailCustomer.id,
      note: newNote.trim(),
      author_name: 'Sales Staff',
      author_role: 'sales',
    }).select('*').single();

    if (!error && data) {
      setNotesList([data, ...notesList]);
      setNewNote('');
    } else {
      // Fallback update
      const updatedNotes = `${detailCustomer.notes ? detailCustomer.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}]: ${newNote.trim()}`;
      await supabase.from('customers').update({ notes: updatedNotes }).eq('id', detailCustomer.id);
      setNotesList([{ id: String(Date.now()), note: newNote.trim(), author_name: 'Sales Staff', created_at: new Date().toISOString() }, ...notesList]);
      setNewNote('');
    }
    setAddingNote(false);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Customers"
        subtitle="Manage your CRM records, leads, and follow-ups."
        action={<Button onClick={openNew}><Plus size={16} /> New customer</Button>}
      />

      <Card className="p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, mobile, or business…"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-ink-200 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition"
            />
          </div>
          <div className="flex gap-3">
            <Select value={filterType} onChange={setFilterType} options={[{ value: 'all', label: 'All types' }, ...typeOptions]} />
            <Select value={filterStatus} onChange={setFilterStatus} options={[{ value: 'all', label: 'All statuses' }, ...statusOptions]} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" size={24} /></div>
        ) : customers.length === 0 ? (
          <EmptyState title="No customers found" subtitle="Add your first customer to get started." icon={<Users size={28} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 border-b border-ink-200 bg-ink-50/50">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Follow-up</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50 transition">
                    <td className="px-5 py-3.5">
                      <button onClick={() => openDetail(c)} className="text-left group">
                        <p className="font-medium text-ink-900 group-hover:text-brand-600 underline-offset-2 hover:underline">{c.name}</p>
                        {c.business_name && <p className="text-xs text-ink-500">{c.business_name}</p>}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-ink-700">{c.mobile}</p>
                      {c.email ? <p className="text-xs text-ink-500">{c.email}</p> : null}
                    </td>
                    <td className="px-5 py-3.5"><Badge tone={typeTone[c.customer_type]}>{c.customer_type}</Badge></td>
                    <td className="px-5 py-3.5"><Badge tone={statusTone[c.status]}>{c.status}</Badge></td>
                    <td className="px-5 py-3.5 text-ink-600">{c.follow_up_date ? c.follow_up_date : '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openDetail(c)} className="p-2 rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600 transition" title="View Customer Details & Notes">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => openEdit(c)} className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition" title="Edit Customer">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => remove(c)} className="p-2 rounded-lg text-ink-500 hover:bg-red-50 hover:text-danger-600 transition" title="Delete Customer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Customer Detail Page & Follow-Up Notes Drawer */}
      {detailCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink-900/40 backdrop-blur-sm">
          <Card className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto animate-slide-in sm:animate-fade-in rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="font-display font-semibold text-ink-900 text-lg">{detailCustomer.name}</h2>
                {detailCustomer.business_name && <p className="text-xs text-ink-500">{detailCustomer.business_name}</p>}
              </div>
              <button onClick={() => setDetailCustomer(null)} className="p-1.5 rounded-lg hover:bg-ink-100"><X size={18} className="text-ink-500" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-ink-50/70 border border-ink-100 text-xs">
                <div>
                  <span className="text-ink-400 block font-medium">Mobile</span>
                  <span className="text-ink-900 font-medium">{detailCustomer.mobile}</span>
                </div>
                <div>
                  <span className="text-ink-400 block font-medium">Email</span>
                  <span className="text-ink-900 font-medium">{detailCustomer.email || '—'}</span>
                </div>
                <div>
                  <span className="text-ink-400 block font-medium">Type</span>
                  <Badge tone={typeTone[detailCustomer.customer_type]}>{detailCustomer.customer_type}</Badge>
                </div>
                <div>
                  <span className="text-ink-400 block font-medium">Status</span>
                  <Badge tone={statusTone[detailCustomer.status]}>{detailCustomer.status}</Badge>
                </div>
                <div>
                  <span className="text-ink-400 block font-medium">GST Number</span>
                  <span className="text-ink-900 font-mono">{detailCustomer.gst_number || '—'}</span>
                </div>
                <div>
                  <span className="text-ink-400 block font-medium">Follow-up Date</span>
                  <span className="text-ink-900 font-medium">{detailCustomer.follow_up_date || '—'}</span>
                </div>
              </div>

              {detailCustomer.address && (
                <div className="text-xs">
                  <span className="text-ink-400 block font-medium mb-1">Address</span>
                  <p className="text-ink-700 bg-white p-3 rounded-xl border border-ink-100">{detailCustomer.address}</p>
                </div>
              )}

              {/* Follow-up Notes Activity Log Section */}
              <div className="pt-2 border-t border-ink-100">
                <h3 className="font-display font-semibold text-ink-900 text-sm mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-brand-500" /> Follow-Up Notes & Activity Log
                </h3>

                {/* Form to add new note */}
                <form onSubmit={handleAddNote} className="mb-4">
                  <Textarea
                    value={newNote}
                    onChange={setNewNote}
                    placeholder="Add a new follow-up note, call summary, or customer feedback..."
                    rows={2}
                  />
                  <div className="flex justify-end mt-2">
                    <Button type="submit" size="sm" disabled={addingNote || !newNote.trim()}>
                      {addingNote ? <Loader2 size={14} className="animate-spin" /> : null} Add Note
                    </Button>
                  </div>
                </form>

                {/* Timeline of notes */}
                {notesList.length === 0 ? (
                  <p className="text-xs text-ink-400 text-center py-4 bg-ink-50/50 rounded-xl border border-dashed border-ink-200">
                    No follow-up notes recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {notesList.map((n) => (
                      <div key={n.id} className="p-3.5 rounded-xl bg-white border border-ink-200/80 shadow-soft text-xs">
                        <div className="flex items-center justify-between text-ink-400 mb-1.5">
                          <span className="font-semibold text-ink-700">{n.author_name || 'Staff'} ({n.author_role || 'sales'})</span>
                          <span>{new Date(n.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                        </div>
                        <p className="text-ink-800 whitespace-pre-line leading-relaxed">{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* New/Edit customer modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink-900/40 backdrop-blur-sm">
          <Card className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto animate-slide-in sm:animate-fade-in rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-display font-semibold text-ink-900">{editing ? 'Edit customer' : 'New customer'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-ink-100"><X size={18} className="text-ink-500" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} required placeholder="Rahul Sharma" />
                <Input label="Mobile" value={draft.mobile} onChange={(v) => setDraft({ ...draft, mobile: v })} required placeholder="98765 43210" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} type="email" placeholder="rahul@email.com" />
                <Input label="Business name" value={draft.business_name} onChange={(v) => setDraft({ ...draft, business_name: v })} placeholder="Sharma Traders" />
              </div>
              <Input label="GST number" value={draft.gst_number} onChange={(v) => setDraft({ ...draft, gst_number: v })} placeholder="22AAAAA0000A1Z5" />
              <Textarea label="Address" value={draft.address} onChange={(v) => setDraft({ ...draft, address: v })} placeholder="Street, city, state, pincode" />
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label="Customer type" value={draft.customer_type} onChange={(v) => setDraft({ ...draft, customer_type: v as CustomerType })} options={typeOptions} />
                <Select label="Status" value={draft.status} onChange={(v) => setDraft({ ...draft, status: v as CustomerStatus })} options={statusOptions} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Follow-up date" value={draft.follow_up_date ?? ''} onChange={(v) => setDraft({ ...draft, follow_up_date: v })} type="date" />
              </div>
              <Textarea label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} placeholder="Preferences, history, reminders…" />
              {error && <div className="text-sm text-danger-600 bg-danger-500/5 border border-danger-500/20 rounded-xl px-3.5 py-2.5">{error}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : null}{editing ? 'Save changes' : 'Add customer'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

