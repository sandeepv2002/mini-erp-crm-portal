import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { AppShell, type ViewKey } from '@/components/AppShell';
import { Dashboard } from '@/views/Dashboard';
import { CustomersView } from '@/views/Customers';
import { ProductsView } from '@/views/Products';
import { StockMovementsView } from '@/views/StockMovements';
import { SalesChallansView } from '@/views/SalesChallans';

function Portal() {
  const { session, profile, loading } = useAuth();
  const [view, setView] = useState<ViewKey>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  return (
    <AppShell current={view} onNavigate={setView}>
      {view === 'dashboard' && <Dashboard onNavigate={(v) => setView(v)} />}
      {view === 'customers' && <CustomersView />}
      {view === 'products' && <ProductsView />}
      {view === 'movements' && <StockMovementsView />}
      {view === 'challans' && <SalesChallansView />}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Portal />
    </AuthProvider>
  );
}
