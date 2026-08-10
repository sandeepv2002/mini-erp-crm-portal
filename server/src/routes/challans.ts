import { Router, Response } from 'express';
import { z } from 'zod';
import pool, { query } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { generateChallanPDF } from './pdf';

const router = Router();

const challanItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name_snapshot: z.string().min(1),
  sku_snapshot: z.string().min(1),
  unit_price_snapshot: z.number().min(0),
  quantity: z.number().int().min(1),
  line_total: z.number().min(0),
});

const challanSchema = z.object({
  customer_id: z.string().uuid('Customer ID required'),
  status: z.enum(['Draft', 'Confirmed']).default('Draft'),
  items: z.array(challanItemSchema).min(1, 'Challan must have at least one product item'),
});

// GET /api/challans
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT sc.*, c.name as customer_name, c.mobile as customer_mobile, c.business_name as customer_business_name
      FROM sales_challans sc
      JOIN customers c ON sc.customer_id = c.id
      ORDER BY sc.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const countSql = 'SELECT COUNT(*) FROM sales_challans';

    const { rows: data } = await query(sql, [limit, offset]);
    const { rows: countRows } = await query(countSql);
    const count = parseInt(countRows[0].count);

    return res.json({
      success: true,
      data: data.map(row => ({
        ...row,
        customer: { name: row.customer_name, mobile: row.customer_mobile, business_name: row.customer_business_name }
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

// GET /api/challans/:id (Detail view with items)
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT sc.*, 
             c.id as customer_id, c.name as customer_name, c.mobile as customer_mobile, c.business_name as customer_business_name, c.address as customer_address, c.gst_number as customer_gst_number
      FROM sales_challans sc
      JOIN customers c ON sc.customer_id = c.id
      WHERE sc.id = $1
    `;
    const { rows: challans } = await query(sql, [id]);

    if (challans.length === 0) {
      return res.status(404).json({ success: false, error: 'Sales challan not found' });
    }

    const { rows: items } = await query('SELECT * FROM challan_items WHERE challan_id = $1', [id]);
    
    const cData = challans[0];
    
    return res.json({
      success: true,
      data: {
        ...cData,
        customer: {
          id: cData.customer_id,
          name: cData.customer_name,
          mobile: cData.customer_mobile,
          business_name: cData.customer_business_name,
          address: cData.customer_address,
          gst_number: cData.customer_gst_number
        },
        items: items.map(it => ({
          ...it,
          product_name_snapshot: it.product_snapshot?.name,
          sku_snapshot: it.product_snapshot?.sku,
          unit_price_snapshot: it.unit_price,
          line_total: it.total_price
        }))
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// POST /api/challans (Create Challan)
router.post('/', authenticateToken, requireRole(['admin', 'sales', 'accounts']), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const parseResult = challanSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { customer_id, status, items } = parseResult.data;

    const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);
    const seq = String(Date.now()).slice(-6);
    const challanNumber = `CHN-${new Date().getFullYear()}-${seq}`;

    await client.query('BEGIN');

    // Insert main challan
    const { rows: challans } = await client.query(
      `INSERT INTO sales_challans (challan_number, customer_id, status, total_amount, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [challanNumber, customer_id, 'Draft', totalAmount, req.user?.userId]
    );
    const challan = challans[0];

    // Insert items
    for (const item of items) {
      await client.query(
        `INSERT INTO challan_items (challan_id, product_id, quantity, unit_price, total_price, product_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [challan.id, item.product_id, item.quantity, item.unit_price_snapshot, item.line_total, JSON.stringify({ name: item.product_name_snapshot, price: item.unit_price_snapshot, sku: item.sku_snapshot })]
      );
    }

    // If requested to confirm immediately
    if (status === 'Confirmed') {
      for (const item of items) {
        const { rows: prods } = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
        if (prods.length === 0 || prods[0].current_stock < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for product "${item.product_name_snapshot}". Available: ${prods[0]?.current_stock ?? 0}, Requested: ${item.quantity}`,
          });
        }
        await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES ($1, $2, $3, $4, $5)`,
          [item.product_id, item.quantity, 'OUT', `Sales challan ${challan.challan_number}`, req.user?.userId]
        );
      }
      await client.query("UPDATE sales_challans SET status = 'Confirmed' WHERE id = $1", [challan.id]);
    }

    await client.query('COMMIT');

    const { rows: finalChallans } = await query('SELECT * FROM sales_challans WHERE id = $1', [challan.id]);

    return res.status(201).json({
      success: true,
      message: 'Sales challan created successfully',
      data: finalChallans[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  } finally {
    client.release();
  }
});

// POST /api/challans/:id/confirm (Confirm challan & reduce stock)
router.post('/:id/confirm', authenticateToken, requireRole(['admin', 'sales', 'warehouse', 'accounts']), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');

    const { rows: challans } = await client.query('SELECT * FROM sales_challans WHERE id = $1 FOR UPDATE', [id]);
    if (challans.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Sales challan not found' });
    }

    const challan = challans[0];
    if (challan.status !== 'Draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Challan is already ${challan.status}` });
    }

    const { rows: items } = await client.query('SELECT * FROM challan_items WHERE challan_id = $1', [id]);
    if (items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Challan has no line items' });
    }

    for (const item of items) {
      const { rows: prods } = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
      if (prods.length === 0 || prods[0].current_stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for product. Available: ${prods[0]?.current_stock ?? 0}, Requested: ${item.quantity}`,
        });
      }
      
      await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) VALUES ($1, $2, $3, $4, $5)`,
        [item.product_id, item.quantity, 'OUT', `Sales challan ${challan.challan_number}`, req.user?.userId]
      );
    }

    await client.query("UPDATE sales_challans SET status = 'Confirmed' WHERE id = $1", [id]);
    await client.query('COMMIT');

    const { rows: updatedChallans } = await query('SELECT * FROM sales_challans WHERE id = $1', [id]);

    return res.json({
      success: true,
      message: 'Sales challan confirmed and stock updated.',
      data: updatedChallans[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  } finally {
    client.release();
  }
});

// GET /api/challans/:id/pdf (Export Challan as PDF Invoice)
router.get('/:id/pdf', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT sc.*, c.name as customer_name, c.mobile as customer_mobile, c.address as customer_address, c.business_name as customer_business_name, c.gst_number as customer_gst_number
      FROM sales_challans sc
      JOIN customers c ON sc.customer_id = c.id
      WHERE sc.id = $1
    `;
    const { rows: challans } = await query(sql, [id]);

    if (challans.length === 0) {
      return res.status(404).json({ success: false, error: 'Sales challan not found' });
    }
    
    const challan = challans[0];
    const { rows: items } = await query('SELECT * FROM challan_items WHERE challan_id = $1', [id]);

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    generateChallanPDF(
      {
        challanNumber: challan.challan_number,
        createdDate: new Date(challan.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' }),
        status: challan.status,
        customerName: challan.customer_name || 'Customer',
        customerMobile: challan.customer_mobile || 'N/A',
        customerAddress: challan.customer_address,
        businessName: challan.customer_business_name,
        gstNumber: challan.customer_gst_number,
        items: items.map((it) => ({
          productName: it.product_snapshot?.name || 'Unknown',
          sku: it.product_snapshot?.sku || 'Unknown',
          unitPrice: Number(it.unit_price),
          quantity: it.quantity,
          lineTotal: Number(it.total_price),
        })),
        totalQuantity: totalQuantity,
        totalAmount: Number(challan.total_amount),
      },
      res
    );
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error generating PDF', details: error.message });
  }
});

export default router;
