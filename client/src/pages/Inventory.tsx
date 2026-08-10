import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, Select, InputNumber, message } from 'antd';
import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { Search } = Input;

const Inventory: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [search, setSearch] = useState('');

  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  const [productForm] = Form.useForm();
  const [stockForm] = Form.useForm();

  const fetchProducts = async (page = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/products`, {
        params: { page, limit: pagination.pageSize, search: searchQuery }
      });
      setData(res.data.data);
      setPagination({
        ...pagination,
        current: res.data.pagination.page,
        total: res.data.pagination.totalItems
      });
    } catch {
      message.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1, search);
  }, [search]);

  const handleTableChange = (newPagination: any) => {
    fetchProducts(newPagination.current, search);
  };

  const handleAddProduct = async (values: any) => {
    try {
      await axios.post('http://localhost:5000/api/products', values);
      message.success('Product added successfully');
      setIsProductModalVisible(false);
      productForm.resetFields();
      fetchProducts(pagination.current, search);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to add product');
    }
  };

  const handleStockAdjustment = async (values: any) => {
    try {
      await axios.post('http://localhost:5000/api/stock-movements', {
        product_id: selectedProduct.id,
        quantity: values.quantity,
        movement_type: values.movement_type,
        reason: values.reason
      });
      message.success('Stock adjusted successfully');
      setIsStockModalVisible(false);
      stockForm.resetFields();
      fetchProducts(pagination.current, search);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to adjust stock');
    }
  };

  const openStockModal = (record: any) => {
    setSelectedProduct(record);
    setIsStockModalVisible(true);
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Product Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Price (₹)', dataIndex: 'unit_price', key: 'unit_price' },
    { 
      title: 'Current Stock', 
      key: 'current_stock',
      render: (_: any, record: any) => (
        <Tag color={record.current_stock <= record.min_stock_alert ? 'red' : 'green'}>
          {record.current_stock}
        </Tag>
      )
    },
    { title: 'Location', dataIndex: 'location', key: 'location' },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button size="small" type="primary" ghost icon={<SwapOutlined />} onClick={() => openStockModal(record)}>
          Adjust Stock
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Search 
          placeholder="Search products by SKU or Name..." 
          allowClear
          onSearch={(value: string) => setSearch(value)}
          onPressEnter={(e: any) => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsProductModalVisible(true)}>
          Add Product
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
        title="Add New Product" 
        open={isProductModalVisible} 
        onCancel={() => setIsProductModalVisible(false)}
        footer={null}
      >
        <Form form={productForm} layout="vertical" onFinish={handleAddProduct}>
          <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unit_price" label="Unit Price" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="current_stock" label="Initial Stock" rules={[{ required: true }]} initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="min_stock_alert" label="Min Stock Alert Level" rules={[{ required: true }]} initialValue={10}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="location" label="Warehouse Location" initialValue="Main Warehouse">
            <Input />
          </Form.Item>
          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsProductModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal 
        title={`Adjust Stock: ${selectedProduct?.name}`} 
        open={isStockModalVisible} 
        onCancel={() => setIsStockModalVisible(false)}
        footer={null}
      >
        <Form form={stockForm} layout="vertical" onFinish={handleStockAdjustment}>
          <Form.Item name="movement_type" label="Movement Type" rules={[{ required: true }]}>
            <Select>
              <Option value="IN">Stock IN (Receive)</Option>
              <Option value="OUT">Stock OUT (Issue)</Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
             <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="reason" label="Reason / Remarks" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsStockModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Confirm Adjustment</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Inventory;
