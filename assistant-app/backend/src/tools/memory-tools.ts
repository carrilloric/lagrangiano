import Anthropic from '@anthropic-ai/sdk';
import { getMem0Client } from '../services/mem0-client.js';
import { MemoryScope, Mem0Memory, Mem0SearchResult } from '../types/index.js';

/**
 * Custom memory tools for Claude Agent SDK
 * These tools make HTTP calls to mem0 Platform API
 */

// Tool definitions for Claude
export const memoryToolDefinitions: Anthropic.Tool[] = [
  {
    name: 'remember',
    description: `Store information in memory for future recall. Use this to save important facts, preferences, or context that should be remembered.

Scopes:
- "user": Personal memories for the current user (preferences, facts about them)
- "global": Shared knowledge accessible to all users (company policies, general facts)
- "conversation": Context specific to the current conversation

Examples:
- User says "My favorite color is blue" → remember with scope "user"
- User mentions company policy → remember with scope "global"
- User discusses project details → remember with scope "conversation"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'The information to remember. Be specific and include context.',
        },
        scope: {
          type: 'string',
          enum: ['user', 'global', 'conversation'],
          description: 'The scope of the memory',
        },
      },
      required: ['content', 'scope'],
    },
  },
  {
    name: 'recall',
    description: `Search and retrieve relevant memories. Use this to find previously stored information that might be relevant to the current conversation.

Scopes:
- "user": Search user's personal memories
- "global": Search shared knowledge
- "conversation": Search current conversation context

Use this proactively when:
- User asks about their preferences
- You need context from earlier in the conversation
- Looking for relevant background information`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'What to search for. Use natural language.',
        },
        scope: {
          type: 'string',
          enum: ['user', 'global', 'conversation'],
          description: 'Where to search',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
      },
      required: ['query', 'scope'],
    },
  },
  {
    name: 'get_context',
    description: `Get full context for the current user. Retrieves all user memories and optionally global knowledge.

Use this at the start of conversations or when you need comprehensive background on the user.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        include_global: {
          type: 'boolean',
          description: 'Whether to include global memories (default: true)',
        },
      },
      required: [],
    },
  },
];

/**
 * Context for tool execution
 */
export interface ToolContext {
  userId: string;
  conversationId: string;
}

/**
 * Execute a memory tool
 */
export async function executeMemoryTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: ToolContext
): Promise<string> {
  const mem0 = getMem0Client();

  try {
    switch (toolName) {
      case 'remember': {
        const content = toolInput.content as string;
        const scope = toolInput.scope as MemoryScope;

        const memories = await mem0.remember(
          content,
          scope,
          context.userId,
          scope === 'conversation' ? context.conversationId : undefined
        );

        return formatRememberResult(memories, scope);
      }

      case 'recall': {
        const query = toolInput.query as string;
        const scope = toolInput.scope as MemoryScope;
        const limit = (toolInput.limit as number) || 5;

        const results = await mem0.recall(
          query,
          scope,
          context.userId,
          scope === 'conversation' ? context.conversationId : undefined,
          limit
        );

        return formatRecallResult(results, query, scope);
      }

      case 'get_context': {
        const includeGlobal = toolInput.include_global !== false;

        const contextData = await mem0.getContext(context.userId, includeGlobal);

        return formatContextResult(contextData);
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error executing tool ${toolName}:`, errorMessage);
    return `Error: ${errorMessage}`;
  }
}

// Formatting helpers

function formatRememberResult(memories: Mem0Memory[], scope: MemoryScope): string {
  if (!memories || memories.length === 0) {
    return `Memory stored in ${scope} scope (no details returned).`;
  }

  const memorySummary = memories
    .map(m => `- ${m.memory}`)
    .join('\n');

  return `Successfully stored ${memories.length} memory/memories in ${scope} scope:\n${memorySummary}`;
}

function formatRecallResult(
  results: Mem0SearchResult[],
  query: string,
  scope: MemoryScope
): string {
  if (!results || results.length === 0) {
    return `No memories found for "${query}" in ${scope} scope.`;
  }

  const formattedResults = results
    .map((r, i) => {
      const score = (r.score * 100).toFixed(1);
      return `${i + 1}. [${score}% match] ${r.memory}`;
    })
    .join('\n');

  return `Found ${results.length} relevant memories in ${scope} scope:\n${formattedResults}`;
}

function formatContextResult(contextData: {
  user: Mem0Memory[];
  global: Mem0Memory[];
}): string {
  const parts: string[] = [];

  if (contextData.user.length > 0) {
    const userMemories = contextData.user
      .map(m => `- ${m.memory}`)
      .join('\n');
    parts.push(`**User Memories (${contextData.user.length}):**\n${userMemories}`);
  } else {
    parts.push('**User Memories:** None stored yet.');
  }

  if (contextData.global.length > 0) {
    const globalMemories = contextData.global
      .map(m => `- ${m.memory}`)
      .join('\n');
    parts.push(`**Global Knowledge (${contextData.global.length}):**\n${globalMemories}`);
  } else {
    parts.push('**Global Knowledge:** None stored yet.');
  }

  return parts.join('\n\n');
}

/**
 * Check if a tool is a memory tool
 */
export function isMemoryTool(toolName: string): boolean {
  return ['remember', 'recall', 'get_context'].includes(toolName);
}
