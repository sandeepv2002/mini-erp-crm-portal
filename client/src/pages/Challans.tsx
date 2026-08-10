import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  InputNumber,
  Descriptions,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import moment from 'moment';
import api, { API_BASE_URL } from '../api';

const { Option } = Select;

const Challans: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<any>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form] = Form.useForm();

  const [items, setItems] = useState<any[]>([]);

  const fetchChallans = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/challans`, {
        params: { page, limit: pagination.pageSize },
      });
      setData(res.data.data);
      setPagination({
        ...pagination,
        current: res.data.pagination.page,
        total: res.data.pagination.totalItems,
      });
    } catch {
      message.error('Failed to fetch challans');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        api.get('/api/customers?limit=1000'),
        api.get('/api/products?limit=1000'),
      ]);
      setCustomers(cRes.data.data);
      setProducts(pRes.data.data);
    } catch (error) {
      console.error('Failed to load options', error);
    }
  };

  useEffect(() => {
    fetchChallans();
    fetchOptions();
  }, []);

  const handleTableChange = (newPagination: any) => {
    fetchChallans(newPagination.current);
  };

  const handleConfirm = async (id: string) => {
    try {
      await api.post(`/api/challans/${id}/confirm`);
      message.success('Challan confirmed successfully! Stock updated.');
      fetchChallans(pagination.current);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to confirm challan');
    }
  };

  const handleCancelChallan = async (id: string) => {
    try {
      await api.post(`/api/challans/${id}/cancel`);
      message.success('Challan cancelled.');
      fetchChallans(pagination.current);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to cancel challan');
    }
  };

  const handleDownloadPDF = (id: string) => {
    const token = localStorage.getItem('token');
    const url = `${API_BASE_URL}/api/challans/${id}/pdf${token ? `?token=${token}` : ''}`;
    window.open(url, '_blank');
  };

  const openCreateModal = () => {
    setItems([]);
    form.resetFields();
    fetchOptions();
    setIsCreateModalVisible(true);
  };

  const openDetailModal = async (record: any) => {
    setSelectedChallan(record);
    setIsDetailModalVisible(true);
    try {
      const res = await api.get(`/api/challans/${record.id}`);
      setSelectedChallan(res.data.data);
    } catch {
      // Use record from list
    }
  };

  const handleAddItem = (values: any) => {
    const product = products.find((p: any) => p.id === values.product_id);
    if (!product) return;

    if (product.current_stock < values.quantity) {
      message.warning(`Warning: Requested qty (${values.quantity}) exceeds available stock (${product.current_stock}).`);
    }

    const newItem = {
      product_id: product.id,
      product_name_snapshot: product.name,
      sku_snapshot: product.sku,
      unit_price_snapshot: Number(product.unit_price),
      quantity: values.quantity,
      line_total: Number(product.unit_price) * values.quantity,
    };

    setItems([...items, newItem]);
    form.setFieldsValue({ product_id: undefined, quantity: 1 });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleCreateSubmit = async () => {
    if (items.length === 0) {
      return message.error('Please add at least one product item to the challan.');
    }

    try {
      const values = await form.validateFields(['customer_id', 'status']);
      const payload = {
        customer_id: values.customer_id,
        status: values.status,
        items,
      };

      await api.post('/api/challans', payload);
      message.success('Sales challan created successfully!');
      setIsCreateModalVisible(false);
      fetchChallans(pagination.current);
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.error || 'Failed to create challan');
      }
    }
  };

  const columns = [
    { title: 'Challan Number', dataIndex: 'challan_number', key: 'challan_number', render: (num: string) => <strong>{num}</strong> },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => moment(date).format('DD MMM YYYY'),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (record: any) => (
        <div>
          <strong>{record.customer?.name || record.customer_name}</strong>
          <div style={{ fontSize: 12, color: '#888' }}>{record.customer?.business_name || record.customer_business_name}</div>
        </div>
      ),
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number) => `₹${Number(amount).toLocaleString('en-IN')}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const s = status?.toLowerCase();
        let color = 'orange';
        if (s === 'confirmed') color = 'green';
        if (s === 'cancelled') color = 'red';
        return <Tag color={color}>{status?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => openDetailModal(record)}>
            View
          </Button>
          <Button size="small" type="link" icon={<FilePdfOutlined />} onClick={() => handleDownloadPDF(record.id)}>
            PDF
          </Button>
          {record.status?.toLowerCase() === 'draft' && (
            <>
              <Popconfirm
                title="Confirm Challan? This will deduct inventory stock immediately."
                onConfirm={() => handleConfirm(record.id)}
              >
                <Button size="small" type="link" style={{ color: 'green' }} icon={<CheckCircleOutlined />}>
                  Confirm
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Cancel this draft challan?"
                onConfirm={() => handleCancelChallan(record.id)}
              >
                <Button size="small" type="link" danger icon={<CloseCircleOutlined />}>
                  Cancel
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Sales Challans & Dispatch</h2>
          <span style={{ color: '#888' }}>Manage delivery challans, stock deductions, and PDF invoices</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          Create Sales Challan
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />

      {/* CREATE CHALLAN MODAL */}
      <Modal
        title="Create Sales Challan"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        onOk={handleCreateSubmit}
        width={820}
        okText="Generate Challan"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="customer_id"
            label="Select Customer"
            rules={[{ required: true, message: 'Please select a customer' }]}
          >
            <Select showSearch placeholder="Search & select a customer" optionFilterProp="children">
              {customers.map((c: any) => (
                <Option key={c.id} value={c.id}>
                  {c.name} {c.business_name ? `(${c.business_name})` : ''} - {c.mobile}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="status" label="Initial Status" rules={[{ required: true }]} initialValue="Draft">
            <Select>
              <Option value="Draft">Draft (Hold - stock will not be deducted yet)</Option>
              <Option value="Confirmed">Confirmed (Deduct stock immediately from warehouse)</Option>
            </Select>
          </Form.Item>
        </Form>

        <div style={{ background: '#f5f7fa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Add Products to Challan</h4>
          <Form layout="inline" onFinish={handleAddItem}>
            <Form.Item
              name="product_id"
              rules={[{ required: true, message: 'Select product' }]}
              style={{ width: 340 }}
            >
              <Select showSearch placeholder="Select product from inventory" optionFilterProp="children">
                {products.map((p: any) => (
                  <Option key={p.id} value={p.id}>
                    {p.name} - ₹{p.unit_price} (Available: {p.current_stock})
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="quantity" rules={[{ required: true }]} initialValue={1}>
              <InputNumber min={1} placeholder="Qty" />
            </Form.Item>
            <Form.Item>
              <Button type="dashed" htmlType="submit" icon={<PlusOutlined />}>
                Add Item
              </Button>
            </Form.Item>
          </Form>
        </div>

        <Table
          dataSource={items}
          rowKey={(_, index) => index?.toString() || ''}
          pagination={false}
          size="small"
          columns={[
            { title: 'Product Name', dataIndex: 'product_name_snapshot' },
            { title: 'SKU', dataIndex: 'sku_snapshot' },
            {
              title: 'Unit Price',
              dataIndex: 'unit_price_snapshot',
              render: (v: number) => `₹${v}`,
            },
            { title: 'Quantity', dataIndex: 'quantity' },
            {
              title: 'Line Total',
              dataIndex: 'line_total',
              render: (v: number) => `₹${v.toLocaleString('en-IN')}`,
            },
            {
              title: 'Action',
              render: (_, __, index) => (
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveItem(index)} />
              ),
            },
          ]}
          summary={(pageData) => {
            const total = pageData.reduce((sum, item) => sum + item.line_total, 0);
            return (
              <Table.Summary.Row style={{ background: '#fafafa' }}>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <strong style={{ float: 'right' }}>Total Challan Amount:</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <strong style={{ color: '#1890ff', fontSize: 15 }}>₹{total.toLocaleString('en-IN')}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}></Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Modal>

      {/* VIEW CHALLAN DETAIL MODAL */}
      <Modal
        title={`Sales Challan Details: ${selectedChallan?.challan_number}`}
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={[
          <Button key="pdf" type="primary" icon={<FilePdfOutlined />} onClick={() => selectedChallan && handleDownloadPDF(selectedChallan.id)}>
            Download PDF Invoice
          </Button>,
          <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={750}
      >
        {selectedChallan && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Challan Number">
                <strong>{selectedChallan.challan_number}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {moment(selectedChallan.created_at).format('DD MMM YYYY, hh:mm A')}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {selectedChallan.customer?.name || selectedChallan.customer_name}
              </Descriptions.Item>
              <Descriptions.Item label="Mobile">
                {selectedChallan.customer?.mobile || selectedChallan.customer_mobile || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedChallan.status?.toLowerCase() === 'confirmed' ? 'green' : 'orange'}>
                  {selectedChallan.status?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                <strong style={{ color: '#1890ff' }}>₹{Number(selectedChallan.total_amount).toLocaleString('en-IN')}</strong>
              </Descriptions.Item>
            </Descriptions>

            <h4>Product Line Items (Snapshots)</h4>
            <Table
              dataSource={selectedChallan.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Product Name', dataIndex: 'product_name_snapshot' },
                { title: 'SKU', dataIndex: 'sku_snapshot' },
                {
                  title: 'Price (₹)',
                  dataIndex: 'unit_price_snapshot',
                  render: (val: number) => `₹${Number(val).toLocaleString('en-IN')}`,
                },
                { title: 'Quantity', dataIndex: 'quantity' },
                {
                  title: 'Line Total (₹)',
                  dataIndex: 'line_total',
                  render: (val: number) => `₹${Number(val).toLocaleString('en-IN')}`,
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Challans;
