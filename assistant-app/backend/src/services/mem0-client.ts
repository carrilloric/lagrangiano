import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Mem0AddMemoryRequest,
  Mem0Memory,
  Mem0SearchRequest,
  Mem0SearchResult,
  Mem0Message,
  MemoryScope,
} from '../types/index.js';

/**
 * HTTP client for mem0 Platform API
 *
 * mem0 Platform handles:
 * - Entity extraction from conversations
 * - Relationship creation in Neo4j
 * - Memory storage and retrieval
 *
 * Your app → mem0 API → mem0 extracts entities → mem0 writes to Neo4j
 */
export class Mem0Client {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.MEM0_API_KEY || '';
    const url = baseUrl || process.env.MEM0_API_URL || 'https://api.mem0.ai/v1';

    if (!this.apiKey) {
      throw new Error('MEM0_API_KEY is required');
    }

    this.client = axios.create({
      baseURL: url,
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Add memories from conversation messages
   * mem0 will automatically extract entities and relationships
   *
   * @example
   * // Add user-scoped memory
   * await mem0.addMemory({
   *   messages: [{ role: 'user', content: 'My favorite color is blue' }],
   *   user_id: 'user123'
   * });
   *
   * // Add global memory
   * await mem0.addMemory({
   *   messages: [{ role: 'user', content: 'Company policy update' }],
   *   user_id: 'global'
   * });
   *
   * // Add conversation-scoped memory
   * await mem0.addMemory({
   *   messages: [{ role: 'user', content: 'In this project...' }],
   *   user_id: 'user123',
   *   metadata: { conversation_id: 'conv456' }
   * });
   */
  async addMemory(request: Mem0AddMemoryRequest): Promise<Mem0Memory[]> {
    try {
      const response = await this.client.post<Mem0Memory[]>('/memories', request);
      return response.data;
    } catch (error) {
      this.handleError(error, 'addMemory');
      throw error;
    }
  }

  /**
   * Get all memories for a user
   *
   * @example
   * const memories = await mem0.getMemories('user123');
   */
  async getMemories(userId: string): Promise<Mem0Memory[]> {
    try {
      const response = await this.client.get<Mem0Memory[]>('/memories', {
        params: { user_id: userId },
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getMemories');
      throw error;
    }
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(memoryId: string): Promise<Mem0Memory> {
    try {
      const response = await this.client.get<Mem0Memory>(`/memories/${memoryId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getMemory');
      throw error;
    }
  }

  /**
   * Search memories using semantic search
   *
   * @example
   * const results = await mem0.searchMemories({
   *   query: 'favorite color',
   *   user_id: 'user123',
   *   limit: 10
   * });
   */
  async searchMemories(request: Mem0SearchRequest): Promise<Mem0SearchResult[]> {
    try {
      const response = await this.client.post<Mem0SearchResult[]>(
        '/memories/search',
        request
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'searchMemories');
      throw error;
    }
  }

  /**
   * Update a memory
   */
  async updateMemory(memoryId: string, text: string): Promise<Mem0Memory> {
    try {
      const response = await this.client.put<Mem0Memory>(`/memories/${memoryId}`, {
        text,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateMemory');
      throw error;
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string): Promise<void> {
    try {
      await this.client.delete(`/memories/${memoryId}`);
    } catch (error) {
      this.handleError(error, 'deleteMemory');
      throw error;
    }
  }

  /**
   * Delete all memories for a user
   */
  async deleteAllMemories(userId: string): Promise<void> {
    try {
      await this.client.delete('/memories', {
        params: { user_id: userId },
      });
    } catch (error) {
      this.handleError(error, 'deleteAllMemories');
      throw error;
    }
  }

  /**
   * Get memory history (versions)
   */
  async getMemoryHistory(memoryId: string): Promise<Mem0Memory[]> {
    try {
      const response = await this.client.get<Mem0Memory[]>(
        `/memories/${memoryId}/history`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getMemoryHistory');
      throw error;
    }
  }

  // Helper methods for scoped memory operations

  /**
   * Remember content with a specific scope
   */
  async remember(
    content: string,
    scope: MemoryScope,
    userId: string,
    conversationId?: string
  ): Promise<Mem0Memory[]> {
    const request: Mem0AddMemoryRequest = {
      messages: [{ role: 'user', content }],
      user_id: scope === 'global' ? 'global' : userId,
    };

    if (scope === 'conversation' && conversationId) {
      request.metadata = { conversation_id: conversationId };
    }

    return this.addMemory(request);
  }

  /**
   * Recall memories matching a query
   */
  async recall(
    query: string,
    scope: MemoryScope,
    userId: string,
    conversationId?: string,
    limit: number = 10
  ): Promise<Mem0SearchResult[]> {
    const request: Mem0SearchRequest = {
      query,
      user_id: scope === 'global' ? 'global' : userId,
      limit,
    };

    if (scope === 'conversation' && conversationId) {
      request.filters = { conversation_id: conversationId };
    }

    return this.searchMemories(request);
  }

  /**
   * Get full context for a user including global memories
   */
  async getContext(
    userId: string,
    includeGlobal: boolean = true
  ): Promise<{ user: Mem0Memory[]; global: Mem0Memory[] }> {
    const userMemories = await this.getMemories(userId);
    const globalMemories = includeGlobal ? await this.getMemories('global') : [];

    return {
      user: userMemories,
      global: globalMemories,
    };
  }

  private handleError(error: unknown, operation: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ detail?: string; message?: string }>;
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail || axiosError.response?.data?.message;

      console.error(`mem0 API error in ${operation}:`, {
        status,
        detail,
        message: axiosError.message,
      });

      if (status === 401) {
        throw new Error('Invalid mem0 API key');
      } else if (status === 404) {
        throw new Error(`Memory not found`);
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (detail) {
        throw new Error(`mem0 API error: ${detail}`);
      }
    }

    throw error;
  }
}

// Singleton instance
let mem0ClientInstance: Mem0Client | null = null;

export function getMem0Client(): Mem0Client {
  if (!mem0ClientInstance) {
    mem0ClientInstance = new Mem0Client();
  }
  return mem0ClientInstance;
}

export default Mem0Client;
