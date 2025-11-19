# AI Assistant with Persistent Memory

A full-stack AI assistant application with persistent memory powered by Claude Agent SDK, mem0 Platform API, and Neo4j Aura.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Next.js        │────▶│  Express        │────▶│  mem0 Platform  │
│  Frontend       │     │  Backend        │     │  API            │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 │                       ▼
                                 │              ┌─────────────────┐
                                 │              │                 │
                                 └─────────────▶│  Neo4j Aura     │
                                  (visualization)│  (Graph DB)     │
                                                │                 │
                                                └─────────────────┘
```

### Memory Flow

1. **User sends message** → Frontend → Backend
2. **Backend processes with Claude Agent SDK** → Agent decides to use memory tools
3. **Memory tools call mem0 API** → POST https://api.mem0.ai/v1/memories
4. **mem0 Platform automatically**:
   - Extracts entities from the content
   - Creates relationships
   - Writes to your Neo4j Aura instance
5. **For visualization** → Backend queries Neo4j directly

## Prerequisites

- Node.js 18+
- mem0 Platform account (https://app.mem0.ai)
- Neo4j Aura Free account (https://console.neo4j.io)
- Anthropic API key

## Setup Instructions

### 1. mem0 Platform Setup

1. **Create account** at https://app.mem0.ai
2. **Get API key** from Dashboard → Settings → API Keys
3. **Configure Neo4j Integration**:
   - Go to Settings → Integrations → Graph Store
   - Select "Neo4j"
   - Enter your Neo4j Aura credentials:
     - URI: `neo4j+s://xxxxx.databases.neo4j.io`
     - Username: `neo4j`
     - Password: Your Neo4j password
   - Save configuration

mem0 will now automatically write extracted entities and relationships to your Neo4j instance.

### 2. Neo4j Aura Setup

1. **Create free instance** at https://console.neo4j.io
2. **Save your credentials** when the instance is created:
   - Connection URI
   - Username (usually `neo4j`)
   - Password (generated)
3. **Provide credentials to BOTH**:
   - mem0 Platform dashboard (so mem0 can write to it)
   - Your backend `.env` file (so you can query for visualization)

### 3. Environment Configuration

Create `.env` files based on `.env.example`:

**Backend** (`/backend/.env`):
```env
# mem0 Platform API
MEM0_API_KEY=mem0-xxx-xxx-xxx
MEM0_API_URL=https://api.mem0.ai/v1

# Neo4j Aura (for direct graph queries/visualization)
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password

# Anthropic (Claude Agent SDK)
ANTHROPIC_API_KEY=sk-ant-api03-xxx

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Server
BACKEND_PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Frontend** (`/frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 5. Running the Application

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## API Reference

### mem0 Platform API Integration

All memory operations go through the mem0 Platform API. Here are example requests:

#### Add Memory

```bash
curl -X POST https://api.mem0.ai/v1/memories \
  -H "Authorization: Token YOUR_MEM0_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "My favorite programming language is Python"}
    ],
    "user_id": "user123"
  }'
```

**Response:**
```json
[
  {
    "id": "mem_abc123",
    "memory": "User prefers Python as their favorite programming language",
    "user_id": "user123",
    "hash": "...",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

#### Search Memories

```bash
curl -X POST https://api.mem0.ai/v1/memories/search \
  -H "Authorization: Token YOUR_MEM0_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "programming language preferences",
    "user_id": "user123",
    "limit": 5
  }'
```

**Response:**
```json
[
  {
    "id": "mem_abc123",
    "memory": "User prefers Python as their favorite programming language",
    "user_id": "user123",
    "score": 0.92,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

#### Get All Memories

```bash
curl -X GET "https://api.mem0.ai/v1/memories?user_id=user123" \
  -H "Authorization: Token YOUR_MEM0_API_KEY"
```

#### Delete Memory

```bash
curl -X DELETE https://api.mem0.ai/v1/memories/mem_abc123 \
  -H "Authorization: Token YOUR_MEM0_API_KEY"
```

### Memory Scopes

The application supports three memory scopes:

1. **USER Memory** (`user_id = "user123"`)
   - Personal preferences, facts about the user
   - Persists across all conversations

2. **GLOBAL Memory** (`user_id = "global"`)
   - Shared knowledge accessible to all users
   - Company policies, general facts

3. **CONVERSATION Memory** (`user_id = "user123"` + `metadata.conversation_id`)
   - Context specific to a single conversation
   - Project details, temporary context

### Backend API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/chat` | Send message (non-streaming) |
| POST | `/api/chat/stream` | Send message (streaming) |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id` | Get conversation with messages |
| DELETE | `/api/conversations/:id` | Delete conversation |
| GET | `/api/memory` | Get user memories |
| POST | `/api/memory` | Add memory |
| POST | `/api/memory/search` | Search memories |
| GET | `/api/memory/graph/:scope` | Get graph visualization data |

## Neo4j Graph Visualization

The `/api/memory/graph/:scope` endpoint returns:
- D3.js formatted graph data for visualization
- Cypher queries for Neo4j Browser exploration
- Node and relationship statistics

### Example Request

```bash
curl -X GET "http://localhost:3001/api/memory/graph/user" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response

```json
{
  "success": true,
  "data": {
    "graph": {
      "nodes": [
        {
          "id": "4:xxx:0",
          "label": "Python",
          "type": "Entity",
          "properties": { "name": "Python", "user_id": "user123" }
        }
      ],
      "links": [
        {
          "source": "4:xxx:0",
          "target": "4:xxx:1",
          "type": "PREFERS"
        }
      ]
    },
    "cypher": {
      "All user memories": "MATCH (n) WHERE n.user_id = 'user123' RETURN n LIMIT 50",
      "User relationships": "MATCH (n)-[r]-(m) WHERE n.user_id = 'user123' RETURN n, r, m LIMIT 100"
    },
    "stats": {
      "nodes": 5,
      "links": 3
    }
  }
}
```

## Neo4j Browser Exploration

Connect to your Neo4j Aura instance using Neo4j Browser and run these queries:

### User Memories

```cypher
// All memories for a user
MATCH (n) WHERE n.user_id = 'user123' RETURN n LIMIT 50

// User's entity relationships
MATCH (e1)-[r]->(e2)
WHERE e1.user_id = 'user123'
RETURN e1, r, e2
LIMIT 100

// Find specific entities
MATCH (e:Entity)
WHERE e.name CONTAINS 'Python'
RETURN e
```

### Global Knowledge

```cypher
// All global memories
MATCH (n) WHERE n.user_id = 'global' RETURN n LIMIT 50

// Global knowledge graph
MATCH (e1:Entity)-[r]->(e2:Entity)
WHERE e1.user_id = 'global'
RETURN e1, r, e2
LIMIT 100
```

### Conversation Context

```cypher
// Memories from specific conversation
MATCH (n)
WHERE n.conversation_id = 'conv456'
RETURN n
LIMIT 50

// Conversation entity graph
MATCH (n)-[r]-(m)
WHERE n.conversation_id = 'conv456'
RETURN n, r, m
LIMIT 100
```

### Graph Exploration

```cypher
// All entity relationships
MATCH (e1:Entity)-[r]->(e2:Entity)
RETURN e1.name, type(r), e2.name
LIMIT 100

// Entity types distribution
MATCH (n)
RETURN labels(n) as type, count(*) as count
ORDER BY count DESC

// Most connected entities
MATCH (n)-[r]-()
RETURN n.name, count(r) as connections
ORDER BY connections DESC
LIMIT 20
```

## Memory System Architecture

### How mem0 Platform Works

1. **Entity Extraction**: When you send content to mem0, it automatically:
   - Identifies entities (people, places, concepts)
   - Extracts relationships between entities
   - Deduplicates information

2. **Graph Storage**: mem0 writes to your Neo4j instance:
   - Creates nodes for entities
   - Creates relationships between nodes
   - Adds metadata (user_id, timestamps, etc.)

3. **Semantic Search**: When you search:
   - Uses embeddings for semantic matching
   - Returns relevance scores
   - Ranks results by similarity

### Agent Memory Tools

The Claude Agent has three memory tools:

```typescript
// remember - Store information
await remember("User prefers dark mode", "user");
// Makes POST request to mem0 API

// recall - Search for information
await recall("theme preferences", "user");
// Makes POST request to mem0 search endpoint

// get_context - Get all user context
await get_context(true); // include global
// Makes GET request to mem0 API
```

## Example Session

### Conversation 1: Setting Preferences

**User:** "My name is Alice and I work at TechCorp as a software engineer. I prefer Python."

**Assistant:** *Uses remember tool to store:*
- User scope: "User's name is Alice"
- User scope: "Works at TechCorp as software engineer"
- User scope: "Prefers Python programming language"

### Conversation 2: Using Memory

**User:** "What technologies should I learn next?"

**Assistant:** *Uses recall tool to search "programming preferences" and "career"*

*Finds memories about Python preference and software engineer role*

**Response:** "Since you're a Python developer at TechCorp, you might want to explore FastAPI for building APIs, or dive into data science with pandas and scikit-learn..."

### Neo4j Graph After Session

```
(Alice:Entity) -[WORKS_AT]-> (TechCorp:Entity)
(Alice:Entity) -[HAS_ROLE]-> (SoftwareEngineer:Entity)
(Alice:Entity) -[PREFERS]-> (Python:Entity)
```

## Deployment

### Vercel (Frontend)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables:
   - `NEXT_PUBLIC_API_URL`: Your backend URL

### Backend Options

**Railway/Render:**
1. Connect GitHub repository
2. Set environment variables
3. Deploy

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## Troubleshooting

### mem0 API Errors

- **401 Unauthorized**: Check MEM0_API_KEY
- **429 Rate Limit**: Wait and retry
- **500 Server Error**: Check mem0 status page

### Neo4j Connection Issues

- Verify URI format: `neo4j+s://xxxxx.databases.neo4j.io`
- Check credentials in both mem0 dashboard and .env
- Ensure Neo4j instance is running

### No Graph Data

- Memories must be added via mem0 API first
- mem0 takes time to extract entities
- Check Neo4j Browser for raw data

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **AI**: Claude Sonnet 4 via Anthropic SDK
- **Memory**: mem0 Platform API
- **Graph DB**: Neo4j Aura Free
- **Auth**: JWT tokens

## License

MIT
