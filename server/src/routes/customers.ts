import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  mobile: z.string().min(8, 'Valid mobile number is required'),
  email: z.string().email().optional().nullable(),
  business_name: z.string().optional().nullable(),
  gst_number: z.string().optional().nullable(),
  customer_type: z.enum(['retail', 'wholesale', 'distributor']),
  status: z.enum(['lead', 'active', 'inactive']),
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

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });

    if (search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,mobile.ilike.%${search.trim()}%,business_name.ilike.%${search.trim()}%`);
    }

    if (type !== 'all') {
      query = query.eq('customer_type', type);
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: 'Database error fetching customers', details: error.message });
    }

    return res.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// GET /api/customers/:id (Customer Detail Page with follow-up notes)
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (custError || !customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Fetch follow-up notes if customer_notes table exists or load from customer.notes
    const { data: notes } = await supabase
      .from('customer_notes')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    return res.json({
      success: true,
      data: {
        ...customer,
        follow_up_notes: notes || [],
      },
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

    const payload = parseResult.data;
    const { data, error } = await supabase
      .from('customers')
      .insert({
        ...payload,
        created_by: req.user?.userId?.startsWith('demo') ? null : req.user?.userId,
      })
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: 'Failed to create customer', details: error.message });
    }

    return res.status(201).json({ success: true, data });
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

    const { data, error } = await supabase
      .from('customers')
      .update({
        ...parseResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: 'Failed to update customer', details: error.message });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// DELETE /api/customers/:id (Delete customer)
router.delete('/:id', authenticateToken, requireRole(['admin', 'sales']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      return res.status(400).json({ success: false, error: 'Failed to delete customer', details: error.message });
    }
    return res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
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

    // Insert into customer_notes table if available or append to customer notes
    const { data: note, error: noteError } = await supabase
      .from('customer_notes')
      .insert({
        customer_id: id,
        note: noteText,
        author_name: req.user?.fullName || 'Staff Member',
        author_role: req.user?.role || 'sales',
      })
      .select('*')
      .single();

    if (noteError) {
      // Fallback: update main customer notes field with appended text
      const { data: cust } = await supabase.from('customers').select('notes').eq('id', id).single();
      const updatedNotes = `${cust?.notes ? cust.notes + '\n\n' : ''}[${new Date().toLocaleDateString()} - ${req.user?.fullName} (${req.user?.role})]: ${noteText}`;
      await supabase.from('customers').update({ notes: updatedNotes }).eq('id', id);
    }

    return res.status(201).json({
      success: true,
      message: 'Follow-up note added successfully',
      data: note || { note: noteText, created_at: new Date().toISOString() },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

export default router;
