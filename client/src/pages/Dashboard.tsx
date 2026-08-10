import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography } from 'antd';
import {
  TeamOutlined,
  WarningOutlined,
  FileTextOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import api from '../api';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    activeCustomers: 0,
    lowStock: 0,
    draftChallans: 0,
    followUps: 0
  });
  
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [recentChallans, setRecentChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [custRes, prodRes, chalRes] = await Promise.all([
          api.get('/api/customers?limit=1000'),
          api.get('/api/products?limit=1000'),
          api.get('/api/challans?limit=5')
        ]);

        const customers = custRes.data.data;
        const products = prodRes.data.data;
        const challans = chalRes.data.data;

        const activeCustomers = customers.filter((c: any) => c.status === 'Active').length;
        const followUps = customers.filter((c: any) => c.follow_up_date && new Date(c.follow_up_date) >= new Date()).length;
        
        const lowStock = products.filter((p: any) => p.current_stock <= p.min_stock_alert);
        
        const drafts = challans.filter((c: any) => c.status === 'Draft').length;

        setStats({
          activeCustomers,
          lowStock: lowStock.length,
          draftChallans: drafts,
          followUps
        });

        setLowStockItems(lowStock.slice(0, 5));
        setRecentChallans(challans);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const lowStockColumns = [
    { title: 'Product', dataIndex: 'name', key: 'name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { 
      title: 'Stock', 
      key: 'stock', 
      render: (record: any) => (
        <Tag color="red">{record.current_stock} / {record.min_stock_alert}</Tag>
      ) 
    },
  ];

  const challanColumns = [
    { title: 'Challan No', dataIndex: 'challan_number', key: 'challan_number' },
    { title: 'Customer', render: (record: any) => record.customer?.name },
    { title: 'Amount', dataIndex: 'total_amount', key: 'total_amount', render: (val: number) => `₹${val}` },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Confirmed' ? 'green' : 'orange'}>{status}</Tag>
      )
    },
  ];

  return (
    <div>
      <Title level={4}>Dashboard Overview</Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ background: '#e6f7ff' }}>
            <Statistic
              title="Active Customers"
              value={stats.activeCustomers}
              prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ background: '#fff1f0' }}>
            <Statistic
              title="Low Stock Items"
              value={stats.lowStock}
              prefix={<WarningOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ background: '#fffbe6' }}>
            <Statistic
              title="Pending Draft Challans"
              value={stats.draftChallans}
              prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ background: '#f6ffed' }}>
            <Statistic
              title="Upcoming Follow Ups"
              value={stats.followUps}
              prefix={<CalendarOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Low Stock Alerts" size="small">
            <Table 
              columns={lowStockColumns} 
              dataSource={lowStockItems} 
              rowKey="id" 
              pagination={false} 
              loading={loading}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Recent Sales Challans" size="small">
            <Table 
              columns={challanColumns} 
              dataSource={recentChallans} 
              rowKey="id" 
              pagination={false} 
              loading={loading}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
