import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getMem0Client } from '../services/mem0-client.js';
import { getNeo4jClient } from '../services/neo4j-client.js';
import { authMiddleware } from '../middleware/auth.js';
import { MemoryScope } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const addMemorySchema = z.object({
  content: z.string().min(1, 'Content is required'),
  scope: z.enum(['user', 'global', 'conversation']),
  conversationId: z.string().optional(),
});

const searchMemorySchema = z.object({
  query: z.string().min(1, 'Query is required'),
  scope: z.enum(['user', 'global', 'conversation']),
  conversationId: z.string().optional(),
  limit: z.number().optional(),
});

/**
 * GET /api/memory
 * Get all memories for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const mem0 = getMem0Client();

    const memories = await mem0.getMemories(userId);

    res.json({
      success: true,
      data: { memories },
    });
  } catch (error) {
    console.error('Get memories error:', error);
    res.status(500).json({ success: false, error: 'Failed to get memories' });
  }
});

/**
 * POST /api/memory
 * Add a memory via mem0 API
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { content, scope, conversationId } = addMemorySchema.parse(req.body);
    const userId = req.user!.id;
    const mem0 = getMem0Client();

    const memories = await mem0.remember(
      content,
      scope as MemoryScope,
      userId,
      scope === 'conversation' ? conversationId : undefined
    );

    res.status(201).json({
      success: true,
      data: { memories },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    console.error('Add memory error:', error);
    res.status(500).json({ success: false, error: 'Failed to add memory' });
  }
});

/**
 * POST /api/memory/search
 * Search memories via mem0 API
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, scope, conversationId, limit } = searchMemorySchema.parse(req.body);
    const userId = req.user!.id;
    const mem0 = getMem0Client();

    const results = await mem0.recall(
      query,
      scope as MemoryScope,
      userId,
      scope === 'conversation' ? conversationId : undefined,
      limit || 10
    );

    res.json({
      success: true,
      data: { results },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    console.error('Search memory error:', error);
    res.status(500).json({ success: false, error: 'Failed to search memories' });
  }
});

/**
 * GET /api/memory/context
 * Get full context (user + global memories)
 */
router.get('/context', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const includeGlobal = req.query.includeGlobal !== 'false';
    const mem0 = getMem0Client();

    const context = await mem0.getContext(userId, includeGlobal);

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({ success: false, error: 'Failed to get context' });
  }
});

/**
 * DELETE /api/memory/:id
 * Delete a specific memory
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mem0 = getMem0Client();

    await mem0.deleteMemory(id);

    res.json({
      success: true,
      message: 'Memory deleted',
    });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete memory' });
  }
});

/**
 * GET /api/memory/graph/:scope
 * Get graph visualization data from Neo4j
 *
 * This endpoint:
 * - Connects to Neo4j directly to query graph structure
 * - Returns D3.js formatted graph data
 * - Returns Cypher queries for Neo4j Browser exploration
 */
router.get('/graph/:scope', async (req: Request, res: Response) => {
  try {
    const { scope } = req.params;
    const userId = req.user!.id;
    const conversationId = req.query.conversationId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!['user', 'global', 'conversation'].includes(scope)) {
      res.status(400).json({ success: false, error: 'Invalid scope' });
      return;
    }

    const neo4j = getNeo4jClient();

    // Get identifier based on scope
    let identifier: string;
    if (scope === 'user') {
      identifier = userId;
    } else if (scope === 'global') {
      identifier = 'global';
    } else {
      if (!conversationId) {
        res.status(400).json({
          success: false,
          error: 'conversationId required for conversation scope',
        });
        return;
      }
      identifier = conversationId;
    }

    // Get graph data
    const graphData = await neo4j.getMemoryGraphByScope(
      scope as 'user' | 'global' | 'conversation',
      identifier,
      limit
    );

    // Convert to D3 format
    const d3Data = neo4j.toD3Format(graphData);

    // Get Cypher queries for exploration
    const cypherQueries = neo4j.getCypherQueries(
      scope as 'user' | 'global' | 'conversation',
      identifier
    );

    res.json({
      success: true,
      data: {
        graph: d3Data,
        cypher: cypherQueries,
        stats: {
          nodes: d3Data.nodes.length,
          links: d3Data.links.length,
        },
      },
    });
  } catch (error) {
    console.error('Get graph error:', error);

    // Return empty graph if Neo4j not configured
    if ((error as Error).message?.includes('credentials not configured')) {
      res.json({
        success: true,
        data: {
          graph: { nodes: [], links: [] },
          cypher: {},
          stats: { nodes: 0, links: 0 },
          warning: 'Neo4j not configured. Graph visualization unavailable.',
        },
      });
      return;
    }

    res.status(500).json({ success: false, error: 'Failed to get graph data' });
  }
});

/**
 * GET /api/memory/graph/search
 * Search entities in the graph
 */
router.get('/graph/search', async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!searchTerm) {
      res.status(400).json({ success: false, error: 'Search term required' });
      return;
    }

    const neo4j = getNeo4jClient();
    const graphData = await neo4j.searchEntities(searchTerm, limit);
    const d3Data = neo4j.toD3Format(graphData);

    res.json({
      success: true,
      data: {
        graph: d3Data,
        stats: {
          nodes: d3Data.nodes.length,
          links: d3Data.links.length,
        },
      },
    });
  } catch (error) {
    console.error('Graph search error:', error);
    res.status(500).json({ success: false, error: 'Failed to search graph' });
  }
});

/**
 * GET /api/memory/stats
 * Get database statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const mem0 = getMem0Client();

    // Get memory counts
    const userMemories = await mem0.getMemories(userId);
    const globalMemories = await mem0.getMemories('global');

    // Try to get Neo4j stats
    let graphStats = { nodes: 0, relationships: 0, labels: 0 };
    try {
      const neo4j = getNeo4jClient();
      graphStats = await neo4j.getStats();
    } catch {
      // Neo4j not configured
    }

    res.json({
      success: true,
      data: {
        memories: {
          user: userMemories.length,
          global: globalMemories.length,
        },
        graph: graphStats,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

export default router;
