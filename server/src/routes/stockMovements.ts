import { Router, Response } from 'express';
import { z } from 'zod';
import pool, { query } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const stockMovementSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  movement_type: z.enum(['IN', 'OUT']),
  reason: z.string().min(2, 'Reason for stock movement is required'),
});

// GET /api/stock-movements (List movements with product details)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT sm.*, p.name as product_name, p.sku as product_sku 
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      ORDER BY sm.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const countSql = 'SELECT COUNT(*) FROM stock_movements';

    const { rows: data } = await query(sql, [limit, offset]);
    const { rows: countRows } = await query(countSql);
    const count = parseInt(countRows[0].count);

    return res.json({
      success: true,
      data: data.map(row => ({
        ...row,
        product: { name: row.product_name, sku: row.product_sku }
      })),
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

// POST /api/stock-movements (Create manual stock adjustment)
router.post('/', authenticateToken, requireRole(['admin', 'warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const parseResult = stockMovementSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { product_id, quantity, movement_type, reason } = parseResult.data;

    await client.query('BEGIN');

    // Fetch product to check current stock (lock row)
    const { rows: products } = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [product_id]);

    if (products.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const product = products[0];
    let newStock = product.current_stock;
    
    if (movement_type === 'IN') {
      newStock += quantity;
    } else {
      if (product.current_stock < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Insufficient stock! Product "${product.name}" currently has ${product.current_stock} units in stock.`,
        });
      }
      newStock -= quantity;
    }

    // Update product stock
    await client.query('UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, product_id]);

    // Record movement
    const insertSql = `
      INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows: movements } = await client.query(insertSql, [product_id, quantity, movement_type, reason, req.user?.userId]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Stock updated successfully. New stock: ${newStock}`,
      data: {
        ...movements[0],
        product: { name: product.name, sku: product.sku }
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  } finally {
    client.release();
  }
});

export default router;
