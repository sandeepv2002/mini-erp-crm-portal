import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  mobile: z.string().min(8, 'Valid mobile number is required'),
  email: z.string().email().optional().nullable(),
  business_name: z.string().optional().nullable(),
  gst_number: z.string().optional().nullable(),
  customer_type: z.enum(['Retail', 'Wholesale', 'Distributor']),
  status: z.enum(['Lead', 'Active', 'Inactive']),
  address: z.string().optional().nullable(),
  follow_up_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const noteSchema = z.object({
  note: z.string().min(1, 'Note content cannot be empty'),
});

// GET /api/customers (List, filter, search, paginate)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const type = (req.query.type as string) || 'all';
    const status = (req.query.status as string) || 'all';

    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM customers WHERE 1=1';
    let countSql = 'SELECT COUNT(*) FROM customers WHERE 1=1';
    const params: any[] = [];
    
    if (search.trim()) {
      const searchParam = `%${search.trim()}%`;
      sql += ` AND (name ILIKE $${params.length + 1} OR mobile ILIKE $${params.length + 1} OR business_name ILIKE $${params.length + 1})`;
      countSql += ` AND (name ILIKE $${params.length + 1} OR mobile ILIKE $${params.length + 1} OR business_name ILIKE $${params.length + 1})`;
      params.push(searchParam);
    }

    if (type !== 'all') {
      sql += ` AND customer_type = $${params.length + 1}`;
      countSql += ` AND customer_type = $${params.length + 1}`;
      params.push(type);
    }

    if (status !== 'all') {
      sql += ` AND status = $${params.length + 1}`;
      countSql += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    const queryParams = [...params, limit, offset];
    
    const { rows: data } = await query(sql, queryParams);
    const { rows: countRows } = await query(countSql, params);
    const count = parseInt(countRows[0].count);

    return res.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// GET /api/customers/:id (Customer Detail Page)
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { rows } = await query('SELECT * FROM customers WHERE id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// POST /api/customers (Add customer)
router.post('/', authenticateToken, requireRole(['admin', 'sales', 'accounts']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const p = parseResult.data;
    
    const insertSql = `
      INSERT INTO customers (name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const params = [p.name, p.mobile, p.email, p.business_name, p.gst_number, p.customer_type, p.address, p.status, p.follow_up_date, p.notes];

    const { rows } = await query(insertSql, params);

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// PUT /api/customers/:id (Edit customer)
router.put('/:id', authenticateToken, requireRole(['admin', 'sales', 'accounts']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = customerSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const fields = parseResult.data;
    const setKeys = Object.keys(fields);
    if (setKeys.length === 0) return res.json({ success: true });

    const setClauses = setKeys.map((key, index) => `${key} = $${index + 1}`);
    const values = Object.values(fields);
    values.push(new Date().toISOString()); // updated_at
    values.push(id); // id for WHERE

    const updateSql = `
      UPDATE customers 
      SET ${setClauses.join(', ')}, updated_at = $${values.length - 1} 
      WHERE id = $${values.length} 
      RETURNING *
    `;

    const { rows } = await query(updateSql, values);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// DELETE /api/customers/:id (Delete customer)
router.delete('/:id', authenticateToken, requireRole(['admin', 'sales']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rowCount } = await query('DELETE FROM customers WHERE id = $1', [id]);
    
    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    return res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete customer', details: error.message });
  }
});

// POST /api/customers/:id/notes (Add follow-up note)
router.post('/:id/notes', authenticateToken, requireRole(['admin', 'sales', 'accounts']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = noteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Note text is required' });
    }

    const noteText = parseResult.data.note;

    // Append to customer notes
    const { rows } = await query('SELECT notes FROM customers WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const existingNotes = rows[0].notes;
    const author = req.user?.fullName || req.user?.email || 'Staff';
    const updatedNotes = `${existingNotes ? existingNotes + '\n\n' : ''}[${new Date().toLocaleDateString()} - ${author} (${req.user?.role})]: ${noteText}`;
    
    const { rows: updatedRows } = await query('UPDATE customers SET notes = $1 WHERE id = $2 RETURNING notes', [updatedNotes, id]);

    return res.status(201).json({
      success: true,
      message: 'Follow-up note added successfully',
      data: { note: noteText, notes: updatedRows[0].notes },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

export default router;
