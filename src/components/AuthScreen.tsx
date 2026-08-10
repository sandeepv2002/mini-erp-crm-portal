import { useState } from 'react';
import { Building, Loader2, Lock, Mail, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/lib/supabase';
import { Button, Input, Select } from '@/components/ui';

const roles: { value: Role; label: string; blurb: string }[] = [
  { value: 'admin', label: 'Admin', blurb: 'Full access to every module' },
  { value: 'sales', label: 'Sales', blurb: 'Customers and sales challans' },
  { value: 'warehouse', label: 'Warehouse', blurb: 'Products and stock movements' },
  { value: 'accounts', label: 'Accounts', blurb: 'Customers, challans, and records' },
];

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('sales');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setBusy(false);
        return;
      }
      const { error } = await signUp(email.trim(), password, fullName.trim() || 'Team member', role);
      if (error) setError(error);
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl">Verve ERP</span>
          </div>
        </div>
        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight mb-4">
            Operations that move with your team.
          </h2>
          <p className="text-ink-300 text-lg max-w-md">
            A single portal for your customers, inventory, and sales challans — built for Admin, Sales, Warehouse, and Accounts to work together.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
            {roles.map((r) => (
              <div key={r.value} className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="font-semibold text-white text-sm">{r.label}</p>
                <p className="text-xs text-ink-400 mt-0.5">{r.blurb}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-ink-400">
          <ShieldCheck size={14} /> Role-based access • Stock protected at the database layer
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-ink-900">Verve ERP</span>
          </div>

          <div className="bg-white rounded-2xl border border-ink-200 shadow-card p-6 sm:p-8">
            <div className="flex p-1 bg-ink-100 rounded-xl mb-6">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    mode === m ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <h1 className="font-display text-2xl font-bold text-ink-900">
              {mode === 'signin' ? 'Welcome back' : 'Join your team'}
            </h1>
            <p className="text-ink-500 text-sm mt-1 mb-6">
              {mode === 'signin'
                ? 'Sign in to access your operations portal.'
                : 'Create an account to start managing operations.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Full name</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Aisha Khan"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-ink-200 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-ink-200 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-ink-200 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <Select
                  label="Role"
                  value={role}
                  onChange={(v) => setRole(v as Role)}
                  options={roles.map((r) => ({ value: r.value, label: `${r.label} — ${r.blurb}` }))}
                />
              )}

              {error && (
                <div className="text-sm text-danger-600 bg-danger-500/5 border border-danger-500/20 rounded-xl px-3.5 py-2.5">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : null}
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-ink-100">
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2.5 text-center">
                Quick Test Login by Role
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { roleName: 'Admin', email: 'admin@erpcrm.com', tone: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
                  { roleName: 'Sales', email: 'sales@erpcrm.com', tone: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
                  { roleName: 'Warehouse', email: 'warehouse@erpcrm.com', tone: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' },
                  { roleName: 'Accounts', email: 'accounts@erpcrm.com', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
                ].map((demo) => (
                  <button
                    key={demo.roleName}
                    type="button"
                    onClick={() => {
                      setEmail(demo.email);
                      setPassword('Password123!');
                    }}
                    className={`py-1.5 px-2.5 rounded-lg border text-xs font-medium transition text-center ${demo.tone}`}
                  >
                    ⚡ Demo {demo.roleName}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-ink-400 text-center mt-4">
              Click a demo role above or use any email & password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

