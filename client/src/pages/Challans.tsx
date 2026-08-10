import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Select, InputNumber, message, Popconfirm } from 'antd';
import { PlusOutlined, FilePdfOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;

const Challans: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form] = Form.useForm();
  
  const [items, setItems] = useState<any[]>([]);

  const fetchChallans = async (page = 1) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/challans`, {
        params: { page, limit: pagination.pageSize }
      });
      setData(res.data.data);
      setPagination({
        ...pagination,
        current: res.data.pagination.page,
        total: res.data.pagination.totalItems
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
        axios.get('http://localhost:5000/api/customers?limit=1000'),
        axios.get('http://localhost:5000/api/products?limit=1000')
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
      await axios.post(`http://localhost:5000/api/challans/${id}/confirm`);
      message.success('Challan confirmed successfully! Stock updated.');
      fetchChallans(pagination.current);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to confirm challan');
    }
  };

  const handleDownloadPDF = (id: string) => {
    window.open(`http://localhost:5000/api/challans/${id}/pdf`, '_blank');
  };

  const openCreateModal = () => {
    setItems([]);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleAddItem = (values: any) => {
    const product = products.find((p: any) => p.id === values.product_id);
    if (!product) return;

    const newItem = {
      product_id: product.id,
      product_name_snapshot: product.name,
      sku_snapshot: product.sku,
      unit_price_snapshot: product.unit_price,
      quantity: values.quantity,
      line_total: product.unit_price * values.quantity,
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
      return message.error('Please add at least one item');
    }
    
    try {
      const values = await form.validateFields(['customer_id', 'status']);
      const payload = {
        customer_id: values.customer_id,
        status: values.status,
        items
      };

      await axios.post('http://localhost:5000/api/challans', payload);
      message.success('Challan created successfully');
      setIsModalVisible(false);
      fetchChallans(pagination.current);
    } catch (error: any) {
      if (error.response) {
         message.error(error.response.data.error || 'Failed to create challan');
      }
    }
  };

  const columns = [
    { title: 'Challan Number', dataIndex: 'challan_number', key: 'challan_number' },
    { 
      title: 'Date', 
      dataIndex: 'created_at', 
      key: 'created_at',
      render: (date: string) => moment(date).format('DD MMM YYYY') 
    },
    { 
      title: 'Customer', 
      key: 'customer',
      render: (record: any) => record.customer?.name
    },
    { 
      title: 'Amount (₹)', 
      dataIndex: 'total_amount', 
      key: 'total_amount',
      render: (amount: number) => Number(amount).toLocaleString('en-IN')
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Confirmed' ? 'green' : 'orange'}>{status}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="link" icon={<FilePdfOutlined />} onClick={() => handleDownloadPDF(record.id)}>PDF</Button>
          {record.status === 'Draft' && (
            <Popconfirm title="Confirm Challan? This will deduct stock." onConfirm={() => handleConfirm(record.id)}>
              <Button type="link" style={{ color: 'green' }} icon={<CheckCircleOutlined />}>Confirm</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
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

      <Modal 
        title="Create Sales Challan" 
        open={isModalVisible} 
        onCancel={() => setIsModalVisible(false)}
        onOk={handleCreateSubmit}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select a customer" optionFilterProp="children">
              {customers.map((c: any) => (
                <Option key={c.id} value={c.id}>{c.name} ({c.mobile})</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="status" label="Status" rules={[{ required: true }]} initialValue="Draft">
            <Select>
              <Option value="Draft">Draft (Hold)</Option>
              <Option value="Confirmed">Confirmed (Deduct Stock immediately)</Option>
            </Select>
          </Form.Item>
        </Form>

        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <Form layout="inline" onFinish={handleAddItem}>
            <Form.Item name="product_id" rules={[{ required: true }]} style={{ width: 300 }}>
              <Select showSearch placeholder="Select product" optionFilterProp="children">
                {products.map((p: any) => (
                  <Option key={p.id} value={p.id}>{p.name} - ₹{p.unit_price} (Stock: {p.current_stock})</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="quantity" rules={[{ required: true }]} initialValue={1}>
              <InputNumber min={1} placeholder="Qty" />
            </Form.Item>
            <Form.Item>
              <Button type="dashed" htmlType="submit" icon={<PlusOutlined />}>Add Item</Button>
            </Form.Item>
          </Form>
        </div>

        <Table 
          dataSource={items} 
          rowKey={(_, index) => index?.toString() || ''}
          pagination={false}
          size="small"
          columns={[
            { title: 'Product', dataIndex: 'product_name_snapshot' },
            { title: 'Price', dataIndex: 'unit_price_snapshot' },
            { title: 'Qty', dataIndex: 'quantity' },
            { title: 'Total', dataIndex: 'line_total' },
            {
              title: 'Action',
              render: (_, __, index) => (
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveItem(index)} />
              )
            }
          ]}
          summary={pageData => {
            const total = pageData.reduce((sum, item) => sum + item.line_total, 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}><strong style={{ float: 'right' }}>Grand Total</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1}><strong>₹{total}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={2}></Table.Summary.Cell>
              </Table.Summary.Row>
            )
          }}
        />
      </Modal>
    </div>
  );
};

export default Challans;
