import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../services/database.js';
import { getAssistantAgent } from '../agents/assistant-agent.js';
import { authMiddleware } from '../middleware/auth.js';
import { ToolContext } from '../tools/memory-tools.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  conversationId: z.string().optional(),
});

/**
 * POST /api/chat
 * Send a message and get a response (non-streaming)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, conversationId } = chatSchema.parse(req.body);
    const userId = req.user!.id;
    const db = getDatabase();

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conversation = db.createConversation(userId, message.substring(0, 50));
      convId = conversation.id;
    } else {
      // Verify conversation belongs to user
      const conversation = db.getConversationById(convId);
      if (!conversation || conversation.userId !== userId) {
        res.status(404).json({ success: false, error: 'Conversation not found' });
        return;
      }
    }

    // Save user message
    db.addMessage(convId, 'user', message);

    // Get conversation history
    const history = db.getRecentMessages(convId, 20);

    // Create tool context
    const context: ToolContext = {
      userId,
      conversationId: convId,
    };

    // Get response from agent
    const agent = getAssistantAgent();
    const response = await agent.chatSync(message, context, history.slice(0, -1));

    // Save assistant response
    db.addMessage(convId, 'assistant', response);

    res.json({
      success: true,
      data: {
        message: response,
        conversationId: convId,
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

    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

/**
 * POST /api/chat/stream
 * Send a message and get a streaming response
 */
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const { message, conversationId } = chatSchema.parse(req.body);
    const userId = req.user!.id;
    const db = getDatabase();

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conversation = db.createConversation(userId, message.substring(0, 50));
      convId = conversation.id;
    } else {
      // Verify conversation belongs to user
      const conversation = db.getConversationById(convId);
      if (!conversation || conversation.userId !== userId) {
        res.status(404).json({ success: false, error: 'Conversation not found' });
        return;
      }
    }

    // Save user message
    db.addMessage(convId, 'user', message);

    // Get conversation history
    const history = db.getRecentMessages(convId, 20);

    // Create tool context
    const context: ToolContext = {
      userId,
      conversationId: convId,
    };

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send conversation ID first
    res.write(`data: ${JSON.stringify({ type: 'start', conversationId: convId })}\n\n`);

    // Stream response
    const agent = getAssistantAgent();
    let fullResponse = '';

    for await (const chunk of agent.chat(message, context, history.slice(0, -1))) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      if (chunk.type === 'text' && chunk.content) {
        fullResponse += chunk.content;
      }
    }

    // Save complete response
    if (fullResponse) {
      db.addMessage(convId, 'assistant', fullResponse);
    }

    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: 'Stream failed' })}\n\n`);
    res.end();
  }
});

export default router;
