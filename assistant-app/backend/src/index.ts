import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import conversationsRoutes from './routes/conversations.js';
import memoryRoutes from './routes/memory.js';

// Create data directory for SQLite
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mem0: !!process.env.MEM0_API_KEY,
      neo4j: !!process.env.NEO4J_URI,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    },
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/memory', memoryRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           AI Assistant Backend Server                       ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                    ║
║                                                            ║
║  API Endpoints:                                            ║
║    POST   /api/auth/register     - Register new user       ║
║    POST   /api/auth/login        - Login                   ║
║    GET    /api/auth/me           - Get current user        ║
║    POST   /api/chat              - Send message            ║
║    POST   /api/chat/stream       - Stream message          ║
║    GET    /api/conversations     - List conversations      ║
║    POST   /api/conversations     - Create conversation     ║
║    GET    /api/conversations/:id - Get conversation        ║
║    GET    /api/memory            - Get memories            ║
║    POST   /api/memory            - Add memory              ║
║    POST   /api/memory/search     - Search memories         ║
║    GET    /api/memory/graph/:scope - Get graph data        ║
║                                                            ║
║  Services:                                                 ║
║    mem0 API:  ${process.env.MEM0_API_KEY ? '✓ Configured' : '✗ Not configured'}                              ║
║    Neo4j:     ${process.env.NEO4J_URI ? '✓ Configured' : '✗ Not configured'}                              ║
║    Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✓ Configured' : '✗ Not configured'}                              ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
