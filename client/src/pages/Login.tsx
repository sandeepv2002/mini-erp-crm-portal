import React, { useState } from 'react';
import { Card, Button, Form, Input, Typography, Divider, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@verveerp.com', type: 'primary' },
  { role: 'Sales', email: 'sales@verveerp.com', type: 'default' },
  { role: 'Warehouse', email: 'warehouse@verveerp.com', type: 'dashed' },
  { role: 'Accounts', email: 'accounts@verveerp.com', type: 'default' }
];

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', {
        email: values.email,
        password: values.password
      });
      
      if (res.data.success) {
        message.success('Login successful!');
        login(res.data.data.token, res.data.data.user);
        navigate('/');
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const loginWithDemo = (email: string) => {
    handleLogin({ email, password: 'password123' });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f2f5' }}>
      <Card style={{ width: 450, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>Verve ERP</Title>
          <Text type="secondary">Sign in to your account</Text>
        </div>

        <Form name="login" onFinish={handleLogin} layout="vertical">
          <Form.Item name="email" rules={[{ required: true, message: 'Please input your email!' }]}>
            <Input prefix={<UserOutlined />} placeholder="Email address" size="large" />
          </Form.Item>
          
          <Form.Item name="password" rules={[{ required: true, message: 'Please input your password!' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <Divider>Or use a demo account</Divider>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {DEMO_ACCOUNTS.map((acc) => (
            <Button 
              key={acc.role} 
              type={acc.type as any} 
              onClick={() => loginWithDemo(acc.email)}
              disabled={loading}
            >
              {acc.role}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Login;
