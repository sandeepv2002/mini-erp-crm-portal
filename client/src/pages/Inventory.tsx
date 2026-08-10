import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  InputNumber,
  Tabs,
  Card,
  message,
} from 'antd';
import {
  PlusOutlined,
  SwapOutlined,
  EditOutlined,
  HistoryOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import moment from 'moment';
import api from '../api';

const { Option } = Select;
const { Search } = Input;

const Inventory: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [movPagination, setMovPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [productForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [stockForm] = Form.useForm();

  const fetchProducts = async (page = 1, searchQuery = search, category = categoryFilter) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/products`, {
        params: {
          page,
          limit: pagination.pageSize,
          search: searchQuery,
          category: category !== 'all' ? category : undefined,
        },
      });
      setData(res.data.data);
      setPagination({
        ...pagination,
        current: res.data.pagination.page,
        total: res.data.pagination.totalItems,
      });
    } catch {
      message.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockMovements = async (page = 1) => {
    setMovementsLoading(true);
    try {
      const res = await api.get('/api/stock-movements', {
        params: { page, limit: movPagination.pageSize },
      });
      setMovements(res.data.data);
      setMovPagination({
        ...movPagination,
        current: res.data.pagination.page,
        total: res.data.pagination.totalItems,
      });
    } catch {
      console.error('Failed to fetch stock movements');
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1, search, categoryFilter);
    fetchStockMovements(1);
  }, [search, categoryFilter]);

  const handleTableChange = (newPagination: any) => {
    fetchProducts(newPagination.current, search, categoryFilter);
  };

  // Add Product
  const handleAddProduct = async (values: any) => {
    try {
      await api.post('/api/products', values);
      message.success('Product created successfully');
      setIsProductModalVisible(false);
      productForm.resetFields();
      fetchProducts(pagination.current, search, categoryFilter);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to add product');
    }
  };

  // Edit Product
  const openEditProductModal = (record: any) => {
    setSelectedProduct(record);
    editForm.setFieldsValue({
      name: record.name,
      sku: record.sku,
      category: record.category,
      unit_price: Number(record.unit_price),
      min_stock_alert: record.min_stock_alert,
      location: record.location,
    });
    setIsEditModalVisible(true);
  };

  const handleEditProduct = async (values: any) => {
    if (!selectedProduct) return;
    try {
      await api.put(`/api/products/${selectedProduct.id}`, values);
      message.success('Product updated successfully');
      setIsEditModalVisible(false);
      fetchProducts(pagination.current, search, categoryFilter);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to update product');
    }
  };

  // Adjust Stock
  const openStockModal = (record: any) => {
    setSelectedProduct(record);
    stockForm.resetFields();
    setIsStockModalVisible(true);
  };

  const handleStockAdjustment = async (values: any) => {
    try {
      await api.post('/api/stock-movements', {
        product_id: selectedProduct.id,
        quantity: values.quantity,
        movement_type: values.movement_type,
        reason: values.reason,
      });
      message.success('Stock adjusted successfully');
      setIsStockModalVisible(false);
      stockForm.resetFields();
      fetchProducts(pagination.current, search, categoryFilter);
      fetchStockMovements(1);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to adjust stock');
    }
  };

  const productColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (sku: string) => <strong>{sku}</strong> },
    { title: 'Product Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (cat: string) => <Tag color="blue">{cat}</Tag> },
    {
      title: 'Price (₹)',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price: number) => `₹${Number(price).toLocaleString('en-IN')}`,
    },
    {
      title: 'Current Stock',
      key: 'current_stock',
      render: (_: any, record: any) => {
        const isLow = record.current_stock <= record.min_stock_alert;
        return (
          <Tag color={isLow ? 'red' : 'green'} style={{ fontWeight: 'bold' }}>
            {record.current_stock} units {isLow ? '(LOW STOCK)' : ''}
          </Tag>
        );
      },
    },
    { title: 'Min Alert', dataIndex: 'min_stock_alert', key: 'min_stock_alert' },
    { title: 'Location', dataIndex: 'location', key: 'location' },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            ghost
            icon={<SwapOutlined />}
            onClick={() => openStockModal(record)}
          >
            Adjust Stock
          </Button>
          <Button
            size="small"
            type="default"
            icon={<EditOutlined />}
            onClick={() => openEditProductModal(record)}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  const movementColumns = [
    {
      title: 'Date & Time',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => moment(date).format('DD MMM YYYY, hh:mm A'),
    },
    {
      title: 'Product',
      key: 'product',
      render: (_: any, record: any) => (
        <div>
          <strong>{record.product_name || record.product?.name}</strong>
          <span style={{ color: '#888', marginLeft: 6 }}>({record.product_sku || record.product?.sku})</span>
        </div>
      ),
    },
    {
      title: 'Movement',
      dataIndex: 'movement_type',
      key: 'movement_type',
      render: (type: string) => {
        const isOut = type?.toUpperCase() === 'OUT';
        return <Tag color={isOut ? 'volcano' : 'green'}>{type?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty: number, record: any) => {
        const isOut = record.movement_type?.toUpperCase() === 'OUT';
        return <strong style={{ color: isOut ? '#cf1322' : '#389e0d' }}>{isOut ? `-${qty}` : `+${qty}`}</strong>;
      },
    },
    { title: 'Reason / Document', dataIndex: 'reason', key: 'reason' },
  ];

  return (
    <div>
      <Tabs
        defaultActiveKey="catalog"
        items={[
          {
            key: 'catalog',
            label: (
              <span>
                <AppstoreOutlined /> Products & Inventory
              </span>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <Space wrap>
                    <Search
                      placeholder="Search by SKU or Product Name..."
                      allowClear
                      onSearch={(value: string) => setSearch(value)}
                      onPressEnter={(e: any) => setSearch(e.target.value)}
                      style={{ width: 280 }}
                    />
                    <Select
                      defaultValue="all"
                      style={{ width: 150 }}
                      onChange={(value: string) => setCategoryFilter(value)}
                    >
                      <Option value="all">All Categories</Option>
                      <Option value="Valves">Valves</Option>
                      <Option value="Plumbing">Plumbing</Option>
                      <Option value="Instruments">Instruments</Option>
                      <Option value="Fittings">Fittings</Option>
                    </Select>
                  </Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsProductModalVisible(true)}>
                    Add Product
                  </Button>
                </div>

                <Table
                  columns={productColumns}
                  dataSource={data}
                  rowKey="id"
                  loading={loading}
                  pagination={pagination}
                  onChange={handleTableChange}
                />
              </div>
            ),
          },
          {
            key: 'audit',
            label: (
              <span>
                <HistoryOutlined /> Stock Movement Audit Log
              </span>
            ),
            children: (
              <div>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <span style={{ color: '#666' }}>
                    Immutable audit log tracking all inventory inward receipts and outward sales dispatches with reasons.
                  </span>
                </Card>
                <Table
                  columns={movementColumns}
                  dataSource={movements}
                  rowKey="id"
                  loading={movementsLoading}
                  pagination={movPagination}
                  onChange={(p) => fetchStockMovements(p.current)}
                />
              </div>
            ),
          },
        ]}
      />

      {/* ADD PRODUCT MODAL */}
      <Modal
        title="Add New Product"
        open={isProductModalVisible}
        onCancel={() => setIsProductModalVisible(false)}
        footer={null}
      >
        <Form form={productForm} layout="vertical" onFinish={handleAddProduct}>
          <Form.Item name="name" label="Product Name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. Industrial Valve 2-inch" />
          </Form.Item>
          <Form.Item name="sku" label="SKU / Code" rules={[{ required: true, message: 'Please enter unique SKU' }]}>
            <Input placeholder="e.g. VALV-002" />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please enter category' }]}>
            <Input placeholder="e.g. Valves, Plumbing, Fittings" />
          </Form.Item>
          <Form.Item name="unit_price" label="Unit Price (₹)" rules={[{ required: true, message: 'Please enter unit price' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="current_stock" label="Initial Stock Quantity" rules={[{ required: true }]} initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="min_stock_alert" label="Minimum Stock Alert Quantity" rules={[{ required: true }]} initialValue={10}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="location" label="Warehouse Location" initialValue="Main Warehouse">
            <Input placeholder="e.g. Rack A-1, Shelf B-2" />
          </Form.Item>
          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsProductModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save Product
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* EDIT PRODUCT MODAL */}
      <Modal
        title={`Edit Product: ${selectedProduct?.name}`}
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditProduct}>
          <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unit_price" label="Unit Price (₹)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="min_stock_alert" label="Minimum Stock Alert Level" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="location" label="Warehouse Location">
            <Input />
          </Form.Item>
          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsEditModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save Changes
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ADJUST STOCK MODAL */}
      <Modal
        title={`Adjust Stock: ${selectedProduct?.name} (Current: ${selectedProduct?.current_stock})`}
        open={isStockModalVisible}
        onCancel={() => setIsStockModalVisible(false)}
        footer={null}
      >
        <Form form={stockForm} layout="vertical" onFinish={handleStockAdjustment}>
          <Form.Item name="movement_type" label="Movement Type" rules={[{ required: true }]} initialValue="IN">
            <Select>
              <Option value="IN">Stock IN (Receive from Supplier / Purchase Order)</Option>
              <Option value="OUT">Stock OUT (Manual Issue / Wastage / Return)</Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity to Adjust" rules={[{ required: true, message: 'Please enter quantity' }]} initialValue={1}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="reason" label="Reason / Remarks" rules={[{ required: true, message: 'Please enter a reason' }]}>
            <Input.TextArea rows={3} placeholder="e.g. Received PO #1005, damaged box replacement, physical count reconciliation..." />
          </Form.Item>
          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsStockModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Confirm Adjustment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Inventory;
