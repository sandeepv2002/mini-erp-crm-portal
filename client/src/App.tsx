import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Challans from './pages/Challans';

const { Header, Sider, Content } = Layout;

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  
  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const getMenuItems = () => {
    const role = user?.role;
    const items = [
      { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' }
    ];

    if (role === 'admin' || role === 'sales' || role === 'accounts') {
      items.push({ key: '/customers', icon: <TeamOutlined />, label: 'Customers' });
    }
    if (role === 'admin' || role === 'warehouse') {
      items.push({ key: '/inventory', icon: <AppstoreOutlined />, label: 'Inventory' });
    }
    if (role === 'admin' || role === 'sales' || role === 'warehouse' || role === 'accounts') {
      items.push({ key: '/challans', icon: <FileTextOutlined />, label: 'Sales Challans' });
    }
    
    return items;
  };

  const userMenuItems = [
    {
      key: 'role',
      disabled: true,
      label: <span className="font-bold capitalize">{user?.role}</span>
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: logout,
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)} theme="dark">
        <div className="flex h-16 items-center justify-center bg-gray-900 m-2 rounded text-white font-bold text-lg">
          {!collapsed ? 'Verve ERP' : 'V'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={getMenuItems()}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="cursor-pointer flex items-center space-x-2">
              <Avatar icon={<UserOutlined />} className="bg-blue-500" />
              <span className="font-medium text-gray-700">{user?.email}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: '16px', overflow: 'initial' }}>
          <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: 'calc(100vh - 112px)' }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute allowedRoles={['admin', 'sales', 'accounts']}><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute allowedRoles={['admin', 'warehouse']}><AppLayout><Inventory /></AppLayout></ProtectedRoute>} />
          <Route path="/challans" element={<ProtectedRoute allowedRoles={['admin', 'sales', 'warehouse', 'accounts']}><AppLayout><Challans /></AppLayout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
