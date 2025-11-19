import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../services/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createConversationSchema = z.object({
  title: z.string().optional(),
});

const updateConversationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

/**
 * GET /api/conversations
 * List all conversations for the current user
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const db = getDatabase();

    const conversations = db.getUserConversations(userId);

    res.json({
      success: true,
      data: { conversations },
    });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to list conversations' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { title } = createConversationSchema.parse(req.body);
    const userId = req.user!.id;
    const db = getDatabase();

    const conversation = db.createConversation(userId, title || 'New Conversation');

    res.status(201).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    console.error('Create conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with messages
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const db = getDatabase();

    const conversation = db.getConversationById(id);

    if (!conversation) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    if (conversation.userId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const messages = db.getConversationMessages(id);

    res.json({
      success: true,
      data: {
        conversation,
        messages,
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to get conversation' });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation title
 */
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = updateConversationSchema.parse(req.body);
    const userId = req.user!.id;
    const db = getDatabase();

    const conversation = db.getConversationById(id);

    if (!conversation) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    if (conversation.userId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    db.updateConversationTitle(id, title);

    const updated = db.getConversationById(id);

    res.json({
      success: true,
      data: { conversation: updated },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    console.error('Update conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const db = getDatabase();

    const conversation = db.getConversationById(id);

    if (!conversation) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    if (conversation.userId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    db.deleteConversation(id);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete conversation' });
  }
});

export default router;
