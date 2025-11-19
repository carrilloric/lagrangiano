// User types
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPayload {
  id: string;
  email: string;
  name: string;
}

// Conversation types
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

// mem0 API types
export interface Mem0Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Mem0AddMemoryRequest {
  messages: Mem0Message[];
  user_id: string;
  agent_id?: string;
  run_id?: string;
  metadata?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  prompt?: string;
}

export interface Mem0Memory {
  id: string;
  memory: string;
  user_id: string;
  hash: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Mem0SearchRequest {
  query: string;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  limit?: number;
  filters?: Record<string, unknown>;
}

export interface Mem0SearchResult {
  id: string;
  memory: string;
  user_id: string;
  hash: string;
  metadata?: Record<string, unknown>;
  score: number;
  created_at: string;
  updated_at: string;
}

// Memory scope types
export type MemoryScope = 'user' | 'global' | 'conversation';

// Neo4j graph types
export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

// D3.js format
export interface D3Node {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface D3Link {
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface D3GraphData {
  nodes: D3Node[];
  links: D3Link[];
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: UserPayload;
}

// Chat types
export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface StreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
}

// Agent tool types
export interface RememberToolInput {
  content: string;
  scope: MemoryScope;
  conversationId?: string;
}

export interface RecallToolInput {
  query: string;
  scope: MemoryScope;
  limit?: number;
}

export interface GetContextToolInput {
  userId: string;
  includeGlobal?: boolean;
}
