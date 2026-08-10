import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
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

    let sql = 'SELECT * FROM products WHERE 1=1';
    let countSql = 'SELECT COUNT(*) FROM products WHERE 1=1';
    const params: any[] = [];
    
    if (search.trim()) {
      const searchParam = `%${search.trim()}%`;
      sql += ` AND (name ILIKE $${params.length + 1} OR sku ILIKE $${params.length + 1})`;
      countSql += ` AND (name ILIKE $${params.length + 1} OR sku ILIKE $${params.length + 1})`;
      params.push(searchParam);
    }

    if (category !== 'all') {
      sql += ` AND category = $${params.length + 1}`;
      countSql += ` AND category = $${params.length + 1}`;
      params.push(category);
    }
    
    if (lowStockOnly) {
      sql += ` AND current_stock <= min_stock_alert`;
      countSql += ` AND current_stock <= min_stock_alert`;
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

// GET /api/products/:id
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    return res.json({ success: true, data: rows[0] });
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
    const sku = payload.sku.toUpperCase();
    
    const insertSql = `
      INSERT INTO products (name, sku, category, unit_price, current_stock, min_stock_alert, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const params = [payload.name, sku, payload.category, payload.unit_price, payload.current_stock, payload.min_stock_alert, payload.location];

    try {
      const { rows } = await query(insertSql, params);
      return res.status(201).json({ success: true, data: rows[0] });
    } catch (dbError: any) {
      if (dbError.code === '23505') {
        return res.status(400).json({ success: false, error: 'A product with this SKU already exists.' });
      }
      throw dbError;
    }
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

    const fields = parseResult.data;
    if (fields.sku) fields.sku = fields.sku.toUpperCase();

    const setKeys = Object.keys(fields);
    if (setKeys.length === 0) return res.json({ success: true });

    const setClauses = setKeys.map((key, index) => `${key} = $${index + 1}`);
    const values = Object.values(fields);
    values.push(new Date().toISOString()); // updated_at
    values.push(id); // id for WHERE

    const updateSql = `
      UPDATE products 
      SET ${setClauses.join(', ')}, updated_at = $${values.length - 1} 
      WHERE id = $${values.length} 
      RETURNING *
    `;

    try {
      const { rows } = await query(updateSql, values);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      return res.json({ success: true, data: rows[0] });
    } catch (dbError: any) {
      if (dbError.code === '23505') {
        return res.status(400).json({ success: false, error: 'A product with this SKU already exists.' });
      }
      throw dbError;
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticateToken, requireRole(['admin', 'warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id]);
    if (rowCount === 0) {
       return res.status(404).json({ success: false, error: 'Product not found' });
    }
    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    if (error.code === '23503') { // foreign key violation
      return res.status(400).json({ success: false, error: 'Failed to delete product. It is referenced by challans or stock logs.' });
    }
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

export default router;
