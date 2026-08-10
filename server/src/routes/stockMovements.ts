import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const stockMovementSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  movement_type: z.enum(['in', 'out']),
  reason: z.string().min(2, 'Reason for stock movement is required'),
});

// GET /api/stock-movements (List movements with product details)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase
      .from('stock_movements')
      .select('*, product:products(name, sku)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ success: false, error: 'Database error fetching stock movements', details: error.message });
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

// POST /api/stock-movements (Create manual stock adjustment)
router.post('/', authenticateToken, requireRole(['admin', 'warehouse']), async (req: AuthenticatedRequest, res: Response) => {
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

    // Fetch product to check current stock
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (prodErr || !product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    let newStock = product.current_stock;
    if (movement_type === 'in') {
      newStock += quantity;
    } else {
      if (product.current_stock < quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock! Product "${product.name}" currently has ${product.current_stock} units in stock.`,
        });
      }
      newStock -= quantity;
    }

    // Update product stock
    const { error: updateErr } = await supabase
      .from('products')
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', product_id);

    if (updateErr) {
      return res.status(500).json({ success: false, error: 'Failed to update product stock', details: updateErr.message });
    }

    // Record movement
    const { data: movement, error: moveErr } = await supabase
      .from('stock_movements')
      .insert({
        product_id,
        quantity,
        movement_type,
        reason,
        created_by: req.user?.userId?.startsWith('demo') ? null : req.user?.userId,
      })
      .select('*, product:products(name, sku)')
      .single();

    if (moveErr) {
      return res.status(500).json({ success: false, error: 'Failed to record stock movement', details: moveErr.message });
    }

    return res.status(201).json({
      success: true,
      message: `Stock updated successfully. New stock: ${newStock}`,
      data: movement,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

export default router;
