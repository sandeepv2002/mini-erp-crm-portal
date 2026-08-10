import { useState, type ReactNode } from 'react';
import { LayoutDashboard, Users, Package, ClipboardList, ArrowLeftRight, LogOut, Menu, X, Building } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/lib/supabase';

export type ViewKey = 'dashboard' | 'customers' | 'products' | 'movements' | 'challans';

const navItems: { key: ViewKey; label: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'sales', 'accounts'] },
  { key: 'products', label: 'Products', icon: Package, roles: ['admin', 'warehouse', 'sales'] },
  { key: 'movements', label: 'Stock Movements', icon: ArrowLeftRight, roles: ['admin', 'warehouse'] },
  { key: 'challans', label: 'Sales Challans', icon: ClipboardList, roles: ['admin', 'sales', 'accounts'] },
];

export function AppShell({
  current,
  onNavigate,
  children,
}: {
  current: ViewKey;
  onNavigate: (v: ViewKey) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visible = navItems.filter((i) => !i.roles || (profile && i.roles.includes(profile.role)));
  const roleLabel = profile ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : '';

  function handleNav(v: ViewKey) {
    onNavigate(v);
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-ink-900 text-ink-100 flex flex-col transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-6 flex items-center gap-2.5 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-soft">
            <Building className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white leading-tight">Verve ERP</p>
            <p className="text-[11px] text-ink-400">Operations portal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = current === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                    : 'text-ink-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center font-semibold text-sm">
              {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name}</p>
              <p className="text-[11px] text-ink-400">{roleLabel} access</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-300 hover:bg-white/5 hover:text-white transition"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-ink-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-ink-100">
            <Menu size={20} className="text-ink-700" />
          </button>
          <span className="font-display font-bold text-ink-900">Verve ERP</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed top-3 right-3 z-50 lg:hidden p-2 rounded-lg bg-white shadow-card"
        >
          <X size={20} className="text-ink-700" />
        </button>
      )}
    </div>
  );
}
