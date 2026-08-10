import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db';
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
  status: z.enum(['draft', 'confirmed']).default('draft'),
  items: z.array(challanItemSchema).min(1, 'Challan must have at least one product item'),
});

// GET /api/challans
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase
      .from('sales_challans')
      .select('*, customer:customers(name, mobile, business_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ success: false, error: 'Database error fetching challans', details: error.message });
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

// GET /api/challans/:id (Detail view with items)
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: challan, error: chError } = await supabase
      .from('sales_challans')
      .select('*, customer:customers(*)')
      .eq('id', id)
      .single();

    if (chError || !challan) {
      return res.status(404).json({ success: false, error: 'Sales challan not found' });
    }

    const { data: items } = await supabase
      .from('challan_items')
      .select('*')
      .eq('challan_id', id);

    return res.json({
      success: true,
      data: {
        ...challan,
        items: items || [],
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// POST /api/challans (Create Challan)
router.post('/', authenticateToken, requireRole(['admin', 'sales', 'accounts']), async (req: AuthenticatedRequest, res: Response) => {
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

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);

    const seq = String(Date.now()).slice(-6);
    const challanNumber = `CHN-${new Date().getFullYear()}-${seq}`;

    // Insert main challan
    const { data: challan, error: chErr } = await supabase
      .from('sales_challans')
      .insert({
        challan_number: challanNumber,
        customer_id,
        status: 'draft',
        total_quantity: totalQuantity,
        total_amount: totalAmount,
        created_by: req.user?.userId?.startsWith('demo') ? null : req.user?.userId,
      })
      .select('*')
      .single();

    if (chErr || !challan) {
      return res.status(400).json({ success: false, error: 'Failed to create sales challan header', details: chErr?.message });
    }

    // Insert items with snapshots
    const challanItemsPayload = items.map((it) => ({
      challan_id: challan.id,
      product_id: it.product_id,
      product_name_snapshot: it.product_name_snapshot,
      sku_snapshot: it.sku_snapshot,
      unit_price_snapshot: it.unit_price_snapshot,
      quantity: it.quantity,
      line_total: it.line_total,
    }));

    const { error: itemsErr } = await supabase.from('challan_items').insert(challanItemsPayload);

    if (itemsErr) {
      await supabase.from('sales_challans').delete().eq('id', challan.id);
      return res.status(400).json({ success: false, error: 'Failed to save challan line items', details: itemsErr.message });
    }

    // If user requested immediate confirmation
    if (status === 'confirmed') {
      const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_sales_challan', { p_challan_id: challan.id });

      if (confirmError) {
        // Perform manual stock verification fallback if RPC isn't deployed
        for (const item of items) {
          const { data: prod } = await supabase.from('products').select('*').eq('id', item.product_id).single();
          if (!prod || prod.current_stock < item.quantity) {
            return res.status(400).json({
              success: false,
              error: `Insufficient stock for product "${item.product_name_snapshot}". Available: ${prod?.current_stock ?? 0}, Requested: ${item.quantity}`,
            });
          }
          await supabase.from('products').update({ current_stock: prod.current_stock - item.quantity }).eq('id', item.product_id);
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            quantity: item.quantity,
            movement_type: 'out',
            reason: `Sales challan ${challan.challan_number}`,
            created_by: req.user?.userId?.startsWith('demo') ? null : req.user?.userId,
          });
        }
        await supabase.from('sales_challans').update({ status: 'confirmed' }).eq('id', challan.id);
      }
    }

    const { data: finalChallan } = await supabase.from('sales_challans').select('*').eq('id', challan.id).single();

    return res.status(201).json({
      success: true,
      message: 'Sales challan created successfully',
      data: finalChallan,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// POST /api/challans/:id/confirm (Confirm challan & reduce stock)
router.post('/:id/confirm', authenticateToken, requireRole(['admin', 'sales', 'warehouse', 'accounts']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: challan, error: chErr } = await supabase.from('sales_challans').select('*').eq('id', id).single();
    if (chErr || !challan) {
      return res.status(404).json({ success: false, error: 'Sales challan not found' });
    }

    if (challan.status !== 'draft') {
      return res.status(400).json({ success: false, error: `Challan is already ${challan.status}` });
    }

    // Try Supabase PL/pgSQL function confirm_sales_challan
    const { error: rpcErr } = await supabase.rpc('confirm_sales_challan', { p_challan_id: id });

    if (rpcErr) {
      // Fallback manual stock validation & transaction logic
      const { data: items } = await supabase.from('challan_items').select('*').eq('challan_id', id);
      if (!items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Challan has no line items' });
      }

      for (const item of items) {
        const { data: prod } = await supabase.from('products').select('*').eq('id', item.product_id).single();
        if (!prod || prod.current_stock < item.quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for product "${item.product_name_snapshot}". Available: ${prod?.current_stock ?? 0}, Requested: ${item.quantity}`,
          });
        }
      }

      // Reduce stock & record OUT movements
      for (const item of items) {
        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
        if (prod) {
          await supabase.from('products').update({ current_stock: prod.current_stock - item.quantity }).eq('id', item.product_id);
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            quantity: item.quantity,
            movement_type: 'out',
            reason: `Sales challan ${challan.challan_number}`,
            created_by: req.user?.userId?.startsWith('demo') ? null : req.user?.userId,
          });
        }
      }

      await supabase.from('sales_challans').update({ status: 'confirmed' }).eq('id', id);
    }

    const { data: updatedChallan } = await supabase.from('sales_challans').select('*').eq('id', id).single();

    return res.json({
      success: true,
      message: 'Sales challan confirmed and stock updated.',
      data: updatedChallan,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// POST /api/challans/:id/cancel
router.post('/:id/cancel', authenticateToken, requireRole(['admin', 'sales', 'accounts']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: challan } = await supabase.from('sales_challans').select('*').eq('id', id).single();
    if (!challan) return res.status(404).json({ success: false, error: 'Challan not found' });
    if (challan.status === 'confirmed') {
      return res.status(400).json({ success: false, error: 'Cannot cancel a confirmed challan' });
    }

    const { data, error } = await supabase.from('sales_challans').update({ status: 'cancelled' }).eq('id', id).select('*').single();
    if (error) return res.status(400).json({ success: false, error: 'Could not cancel challan' });

    return res.json({ success: true, message: 'Challan cancelled', data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error', details: error.message });
  }
});

// GET /api/challans/:id/pdf (Export Challan as PDF Invoice)
router.get('/:id/pdf', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: challan, error: chErr } = await supabase
      .from('sales_challans')
      .select('*, customer:customers(*)')
      .eq('id', id)
      .single();

    if (chErr || !challan) {
      return res.status(404).json({ success: false, error: 'Sales challan not found' });
    }

    const { data: items } = await supabase.from('challan_items').select('*').eq('challan_id', id);

    generateChallanPDF(
      {
        challanNumber: challan.challan_number,
        createdDate: new Date(challan.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' }),
        status: challan.status,
        customerName: challan.customer?.name || 'Customer',
        customerMobile: challan.customer?.mobile || 'N/A',
        customerAddress: challan.customer?.address,
        businessName: challan.customer?.business_name,
        gstNumber: challan.customer?.gst_number,
        items: (items || []).map((it) => ({
          productName: it.product_name_snapshot,
          sku: it.sku_snapshot,
          unitPrice: Number(it.unit_price_snapshot),
          quantity: it.quantity,
          lineTotal: Number(it.line_total),
        })),
        totalQuantity: challan.total_quantity,
        totalAmount: Number(challan.total_amount),
      },
      res
    );
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Server error generating PDF', details: error.message });
  }
});

export default router;
