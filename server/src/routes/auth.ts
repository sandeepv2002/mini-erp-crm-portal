import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db';
import { generateToken, authenticateToken, AuthenticatedRequest, UserRole } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  role: z.enum(['admin', 'sales', 'warehouse', 'accounts'] as const),
});

// Demo predefined credentials fallback mapping for smooth testing
const DEMO_USERS: Record<string, { role: UserRole; fullName: string }> = {
  'admin@erpcrm.com': { role: 'admin', fullName: 'System Admin' },
  'sales@erpcrm.com': { role: 'sales', fullName: 'Sales Representative' },
  'warehouse@erpcrm.com': { role: 'warehouse', fullName: 'Warehouse Manager' },
  'accounts@erpcrm.com': { role: 'accounts', fullName: 'Accounts Specialist' },
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

    // Check demo credentials first
    if (DEMO_USERS[email.toLowerCase()]) {
      const demo = DEMO_USERS[email.toLowerCase()];
      const token = generateToken({
        userId: `demo-${demo.role}-id`,
        email: email.toLowerCase(),
        role: demo.role,
        fullName: demo.fullName,
      });

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: `demo-${demo.role}-id`,
            email: email.toLowerCase(),
            role: demo.role,
            fullName: demo.fullName,
          },
        },
      });
    }

    // Supabase Auth Login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Fetch user profile from Supabase profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', authData.user.id)
      .single();

    const role: UserRole = (profile?.role as UserRole) || 'sales';
    const fullName = profile?.full_name || 'Team Member';

    const token = generateToken({
      userId: authData.user.id,
      email: authData.user.email || email,
      role,
      fullName,
    });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role,
          fullName,
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

// POST /api/auth/register
router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { email, password, fullName, role } = parseResult.data;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });

    if (authError || !authData.user) {
      return res.status(400).json({
        success: false,
        error: authError?.message || 'Could not register user',
      });
    }

    // Ensure profile entry exists
    await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: fullName,
      role,
    });

    const token = generateToken({
      userId: authData.user.id,
      email: authData.user.email || email,
      role,
      fullName,
    });

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: authData.user.id,
          email,
          role,
          fullName,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error during registration',
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
