import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Drawer,
  Form,
  Select,
  DatePicker,
  Descriptions,
  Divider,
  Timeline,
  Card,
  message,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  CommentOutlined,
} from '@ant-design/icons';
import moment from 'moment';
import api from '../api';

const { Option } = Select;
const { Search, TextArea } = Input;

const Customers: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [noteForm] = Form.useForm();

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'all', type: 'all' });

  const fetchCustomers = async (page = 1, filtersObj = filters) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/customers`, {
        params: {
          page,
          limit: pagination.pageSize,
          search: filtersObj.search,
          status: filtersObj.status,
          type: filtersObj.type,
        },
      });
      setData(res.data.data);
      setPagination({
        ...pagination,
        current: res.data.pagination.page,
        total: res.data.pagination.totalItems,
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

  // Add Customer
  const handleAddSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        follow_up_date: values.follow_up_date ? values.follow_up_date.format('YYYY-MM-DD') : null,
      };

      await api.post('/api/customers', payload);
      message.success('Customer added successfully');
      setIsAddModalVisible(false);
      addForm.resetFields();
      fetchCustomers(pagination.current, filters);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to add customer');
    }
  };

  // Edit Customer
  const openEditModal = (customer: any) => {
    setSelectedCustomer(customer);
    editForm.setFieldsValue({
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      business_name: customer.business_name,
      gst_number: customer.gst_number,
      customer_type: customer.customer_type ? customer.customer_type.charAt(0).toUpperCase() + customer.customer_type.slice(1).toLowerCase() : 'Retail',
      status: customer.status ? customer.status.charAt(0).toUpperCase() + customer.status.slice(1).toLowerCase() : 'Lead',
      follow_up_date: customer.follow_up_date ? moment(customer.follow_up_date) : null,
    });
    setIsEditModalVisible(true);
  };

  const handleEditSubmit = async (values: any) => {
    if (!selectedCustomer) return;
    try {
      const payload = {
        ...values,
        follow_up_date: values.follow_up_date ? values.follow_up_date.format('YYYY-MM-DD') : null,
      };

      await api.put(`/api/customers/${selectedCustomer.id}`, payload);
      message.success('Customer updated successfully');
      setIsEditModalVisible(false);
      fetchCustomers(pagination.current, filters);
      if (selectedCustomer) {
        setSelectedCustomer({ ...selectedCustomer, ...payload });
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to update customer');
    }
  };

  // View Details
  const openDetailDrawer = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsDetailDrawerVisible(true);
    try {
      const res = await api.get(`/api/customers/${customer.id}`);
      setSelectedCustomer(res.data.data);
    } catch {
      // Use local state if detail fetch has delay
    }
  };

  // Add Follow-up Note
  const handleAddNote = async (values: any) => {
    if (!selectedCustomer) return;
    try {
      const res = await api.post(`/api/customers/${selectedCustomer.id}/notes`, {
        note: values.note,
      });
      message.success('Follow-up note added!');
      noteForm.resetFields();
      setSelectedCustomer({
        ...selectedCustomer,
        notes: res.data.data.notes,
      });
      fetchCustomers(pagination.current, filters);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to add note');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (name: string) => <strong>{name}</strong> },
    { title: 'Business', dataIndex: 'business_name', key: 'business_name', render: (val: string) => val || '-' },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile' },
    { 
      title: 'Type', 
      dataIndex: 'customer_type', 
      key: 'customer_type',
      render: (type: string) => <Tag color="geekblue">{type?.toUpperCase()}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const s = status?.toLowerCase();
        const color = s === 'active' ? 'green' : s === 'lead' ? 'blue' : 'red';
        return <Tag color={color}>{status?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Follow Up',
      dataIndex: 'follow_up_date',
      key: 'follow_up_date',
      render: (date: string) => (date ? moment(date).format('DD MMM YYYY') : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => openDetailDrawer(record)}>
            View
          </Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Search
            placeholder="Search customers..."
            allowClear
            onSearch={(value: string) => setFilters({ ...filters, search: value })}
            onPressEnter={(e: any) => setFilters({ ...filters, search: e.target.value })}
            style={{ width: 220 }}
          />
          <Select
            defaultValue="all"
            style={{ width: 130 }}
            onChange={(value: string) => setFilters({ ...filters, status: value })}
          >
            <Option value="all">All Status</Option>
            <Option value="Lead">Lead</Option>
            <Option value="Active">Active</Option>
            <Option value="Inactive">Inactive</Option>
          </Select>
          <Select
            defaultValue="all"
            style={{ width: 140 }}
            onChange={(value: string) => setFilters({ ...filters, type: value })}
          >
            <Option value="all">All Types</Option>
            <Option value="Retail">Retail</Option>
            <Option value="Wholesale">Wholesale</Option>
            <Option value="Distributor">Distributor</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddModalVisible(true)}>
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

      {/* ADD CUSTOMER MODAL */}
      <Modal
        title="Add New Customer"
        open={isAddModalVisible}
        onCancel={() => setIsAddModalVisible(false)}
        footer={null}
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddSubmit}>
          <Form.Item name="name" label="Customer Name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. Acme Corporation" />
          </Form.Item>
          <Form.Item name="mobile" label="Mobile Number" rules={[{ required: true, message: 'Please enter mobile' }]}>
            <Input placeholder="e.g. +91 98765 43210" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="customer@example.com" />
          </Form.Item>
          <Form.Item name="business_name" label="Business / Company Name">
            <Input placeholder="Acme Enterprises Ltd" />
          </Form.Item>
          <Form.Item name="gst_number" label="GST Number (Optional)">
            <Input placeholder="29AAAAA0000A1Z5" />
          </Form.Item>
          <Form.Item name="customer_type" label="Customer Type" rules={[{ required: true }]} initialValue="Retail">
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
          <Form.Item name="address" label="Address">
            <TextArea rows={2} placeholder="Full address" />
          </Form.Item>
          <Form.Item name="follow_up_date" label="Follow Up Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsAddModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Create Customer
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* EDIT CUSTOMER MODAL */}
      <Modal
        title={`Edit Customer: ${selectedCustomer?.name}`}
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
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
          <Form.Item name="gst_number" label="GST Number">
            <Input />
          </Form.Item>
          <Form.Item name="customer_type" label="Customer Type" rules={[{ required: true }]}>
            <Select>
              <Option value="Retail">Retail</Option>
              <Option value="Wholesale">Wholesale</Option>
              <Option value="Distributor">Distributor</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
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
              <Button onClick={() => setIsEditModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save Changes
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* CUSTOMER DETAIL DRAWER */}
      <Drawer
        title="Customer CRM Details"
        placement="right"
        width={500}
        open={isDetailDrawerVisible}
        onClose={() => setIsDetailDrawerVisible(false)}
      >
        {selectedCustomer && (
          <div>
            <Descriptions title="Customer Overview" bordered column={1} size="small">
              <Descriptions.Item label="Name">
                <strong>{selectedCustomer.name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Mobile">{selectedCustomer.mobile}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedCustomer.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Business">{selectedCustomer.business_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="GST Number">{selectedCustomer.gst_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color="geekblue">{selectedCustomer.customer_type?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedCustomer.status?.toLowerCase() === 'active' ? 'green' : 'blue'}>
                  {selectedCustomer.status?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Follow Up Date">
                {selectedCustomer.follow_up_date
                  ? moment(selectedCustomer.follow_up_date).format('DD MMM YYYY')
                  : 'No follow up scheduled'}
              </Descriptions.Item>
              <Descriptions.Item label="Address">{selectedCustomer.address || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider>
              <CommentOutlined /> Follow-up Notes & Timeline
            </Divider>

            <div style={{ maxHeight: 220, overflowY: 'auto', background: '#fafafa', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              {selectedCustomer.notes ? (
                <Timeline
                  items={selectedCustomer.notes.split('\n\n').filter(Boolean).map((n: string) => ({
                    color: 'blue',
                    children: <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{n}</p>,
                  }))}
                />
              ) : (
                <p style={{ color: '#999', margin: 0 }}>No notes recorded yet. Add one below!</p>
              )}
            </div>

            <Card size="small" title="Add Follow-up Note">
              <Form form={noteForm} onFinish={handleAddNote}>
                <Form.Item name="note" rules={[{ required: true, message: 'Please enter note content' }]}>
                  <TextArea rows={3} placeholder="Enter discussion summary, follow-up outcome, or next steps..." />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button type="primary" htmlType="submit" icon={<CommentOutlined />} block>
                    Save Follow-up Note
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Customers;
