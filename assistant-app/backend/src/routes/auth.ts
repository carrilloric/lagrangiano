import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../services/database.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const db = getDatabase();

    // Check if user exists
    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ success: false, error: 'Email already registered' });
      return;
    }

    // Create user
    const user = await db.createUser(email, password, name);

    // Generate token
    const userPayload = { id: user.id, email: user.email, name: user.name };
    const token = generateToken(userPayload);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: userPayload,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const db = getDatabase();

    // Find user
    const user = db.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Validate password
    const isValid = await db.validatePassword(user, password);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Generate token
    const userPayload = { id: user.id, email: user.email, name: user.name };
    const token = generateToken(userPayload);

    res.json({
      success: true,
      data: {
        token,
        user: userPayload,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authMiddleware, (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const token = generateToken(req.user);

  res.json({
    success: true,
    data: { token },
  });
});

export default router;
