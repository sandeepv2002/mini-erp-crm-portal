import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Tag, Modal, Form, Select, DatePicker, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;
const { Search } = Input;

const Customers: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'all', type: 'all' });

  const fetchCustomers = async (page = 1, filtersObj = filters) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/customers`, {
        params: {
          page,
          limit: pagination.pageSize,
          search: filtersObj.search,
          status: filtersObj.status,
          type: filtersObj.type
        }
      });
      setData(res.data.data);
      setPagination({
        ...pagination,
        current: res.data.pagination.page,
        total: res.data.pagination.totalItems
      });
    } catch {
      message.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(1, filters);
  }, [filters]);

  const handleTableChange = (newPagination: any) => {
    fetchCustomers(newPagination.current, filters);
  };

  const handleAddSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        follow_up_date: values.follow_up_date ? values.follow_up_date.format('YYYY-MM-DD') : null
      };
      
      await axios.post('http://localhost:5000/api/customers', payload);
      message.success('Customer added successfully');
      setIsModalVisible(false);
      form.resetFields();
      fetchCustomers(pagination.current, filters);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to add customer');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Business', dataIndex: 'business_name', key: 'business_name' },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile' },
    { title: 'Type', dataIndex: 'customer_type', key: 'customer_type' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => {
        const color = status === 'Active' ? 'green' : status === 'Lead' ? 'blue' : 'red';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    { 
      title: 'Follow Up', 
      dataIndex: 'follow_up_date', 
      key: 'follow_up_date',
      render: (date: string) => date ? moment(date).format('DD MMM YYYY') : '-'
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Search 
            placeholder="Search customers..." 
            allowClear
            onSearch={(value: string) => setFilters({ ...filters, search: value })}
            onPressEnter={(e: any) => setFilters({ ...filters, search: e.target.value })}
            style={{ width: 200 }}
          />
          <Select 
            defaultValue="all" 
            style={{ width: 120 }} 
            onChange={(value: string) => setFilters({ ...filters, status: value })}
          >
            <Option value="all">All Status</Option>
            <Option value="Lead">Lead</Option>
            <Option value="Active">Active</Option>
            <Option value="Inactive">Inactive</Option>
          </Select>
          <Select 
            defaultValue="all" 
            style={{ width: 150 }} 
            onChange={(value: string) => setFilters({ ...filters, type: value })}
          >
            <Option value="all">All Types</Option>
            <Option value="Retail">Retail</Option>
            <Option value="Wholesale">Wholesale</Option>
            <Option value="Distributor">Distributor</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
          Add Customer
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
        title="New Customer" 
        open={isModalVisible} 
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddSubmit}>
          <Form.Item name="name" label="Customer Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="mobile" label="Mobile Number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="business_name" label="Business Name">
            <Input />
          </Form.Item>
          <Form.Item name="customer_type" label="Customer Type" rules={[{ required: true }]}>
            <Select>
              <Option value="Retail">Retail</Option>
              <Option value="Wholesale">Wholesale</Option>
              <Option value="Distributor">Distributor</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]} initialValue="Lead">
            <Select>
              <Option value="Lead">Lead</Option>
              <Option value="Active">Active</Option>
              <Option value="Inactive">Inactive</Option>
            </Select>
          </Form.Item>
          <Form.Item name="follow_up_date" label="Follow Up Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Customers;
