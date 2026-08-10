import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import pool, { query } from '../db';
import { generateToken, authenticateToken, AuthenticatedRequest, UserRole } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['Admin', 'Sales', 'Warehouse', 'Accounts'] as const),
});

// Demo predefined credentials fallback mapping for smooth testing
const DEMO_USERS: Record<string, { role: UserRole }> = {
  'admin@verveerp.com': { role: 'admin' },
  'sales@verveerp.com': { role: 'sales' },
  'warehouse@verveerp.com': { role: 'warehouse' },
  'accounts@verveerp.com': { role: 'accounts' },
};


// POST /api/auth/login
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { email, password } = parseResult.data;

    // Check demo credentials first - for testing purposes we allow simple password 'password123'
    if (DEMO_USERS[email.toLowerCase()] && password === 'password123') {
      const demo = DEMO_USERS[email.toLowerCase()];
      
      const { rows } = await query('SELECT id, email, role FROM users WHERE email = $1', [email.toLowerCase()]);
      
      if (rows.length > 0) {
        const user = rows[0];
        const token = generateToken({
          userId: user.id,
          email: user.email,
          role: user.role.toLowerCase() as UserRole,
        });

        return res.json({
          success: true,
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
            },
          },
        });
      }
    }

    // Actual DB Login
    const { rows } = await query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const role: UserRole = user.role.toLowerCase() as UserRole;

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role,
    });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication',
      details: error.message,
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

export default router;
