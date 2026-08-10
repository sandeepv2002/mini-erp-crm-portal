import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(2, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  unit_price: z.number().min(0, 'Price must be >= 0'),
  current_stock: z.number().int().min(0, 'Current stock must be >= 0'),
  min_stock_alert: z.number().int().min(0, 'Min stock alert must be >= 0'),
  location: z.string().optional().default('Main warehouse'),
});

// GET /api/products (List, search, filter, paginate)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const category = (req.query.category as string) || 'all';
    const lowStockOnly = req.query.lowStock === 'true';

    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    if (search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%`);
    }

    if (category !== 'all') {
      query = query.eq('category', category);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: 'Database error fetching products', details: error.message });
    }

    let result = data || [];
    if (lowStockOnly) {
      result = result.filter((p: any) => p.current_stock <= p.min_stock_alert);
    }

    return res.json({
      success: true,
      data: result,
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

// GET /api/products/:id
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// POST /api/products (Add product - Warehouse or Admin)
router.post('/', authenticateToken, requireRole(['admin', 'warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = productSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const payload = parseResult.data;
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...payload,
        sku: payload.sku.toUpperCase(),
        created_by: req.user?.userId?.startsWith('demo') ? null : req.user?.userId,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'A product with this SKU already exists.' });
      }
      return res.status(400).json({ success: false, error: 'Failed to create product', details: error.message });
    }

    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// PUT /api/products/:id (Edit product)
router.put('/:id', authenticateToken, requireRole(['admin', 'warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = productSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const updateData = { ...parseResult.data };
    if (updateData.sku) updateData.sku = updateData.sku.toUpperCase();

    const { data, error } = await supabase
      .from('products')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: 'Failed to update product', details: error.message });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticateToken, requireRole(['admin', 'warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      return res.status(400).json({ success: false, error: 'Failed to delete product. It may be referenced by challans or stock logs.', details: error.message });
    }
    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

export default router;
