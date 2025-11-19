import Anthropic from '@anthropic-ai/sdk';
import {
  memoryToolDefinitions,
  executeMemoryTool,
  isMemoryTool,
  ToolContext,
} from '../tools/memory-tools.js';
import { StreamChunk, Message } from '../types/index.js';

/**
 * AI Assistant Agent with memory capabilities
 * Uses Claude Sonnet 4 with custom tools for mem0 integration
 */
export class AssistantAgent {
  private client: Anthropic;
  private model: string = 'claude-sonnet-4-20250514';

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * System prompt for the assistant
   */
  private getSystemPrompt(): string {
    return `You are a helpful AI assistant with persistent memory capabilities. You can remember information across conversations and recall it when relevant.

## Memory System

You have access to three memory tools:

1. **remember**: Store important information for future use
   - Use "user" scope for personal info (preferences, facts about the user)
   - Use "global" scope for shared knowledge (company policies, general facts)
   - Use "conversation" scope for context specific to this chat

2. **recall**: Search for relevant memories
   - Proactively search when user asks about their preferences
   - Search when you need context from earlier discussions
   - Use semantic search queries

3. **get_context**: Get comprehensive background on the user
   - Use at conversation start to understand the user
   - Retrieves both user and global memories

## Guidelines

- Proactively store important information without being asked
- Always search for relevant context before answering questions about user preferences
- Be transparent about what you remember
- Update memories when information changes
- Don't store sensitive data like passwords or API keys
- Use clear, specific content when storing memories

## Behavior

- Be helpful, accurate, and concise
- When you find relevant memories, naturally incorporate them into your responses
- If you don't find relevant memories, proceed normally
- Acknowledge when you're storing new information`;
  }

  /**
   * Process a chat message with streaming response
   */
  async *chat(
    userMessage: string,
    context: ToolContext,
    conversationHistory: Message[] = []
  ): AsyncGenerator<StreamChunk> {
    // Build messages array
    const messages: Anthropic.MessageParam[] = [
      ...this.formatHistory(conversationHistory),
      { role: 'user', content: userMessage },
    ];

    // Create streaming message
    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      tools: memoryToolDefinitions,
      messages,
      stream: true,
    });

    let currentToolUse: {
      id: string;
      name: string;
      input: string;
    } | null = null;

    // Process stream events
    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start':
          if (event.content_block.type === 'tool_use') {
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: '',
            };
            yield {
              type: 'tool_use',
              toolName: event.content_block.name,
            };
          }
          break;

        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            yield {
              type: 'text',
              content: event.delta.text,
            };
          } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
            currentToolUse.input += event.delta.partial_json;
          }
          break;

        case 'content_block_stop':
          if (currentToolUse) {
            // Execute the tool
            try {
              const toolInput = JSON.parse(currentToolUse.input);
              const result = await executeMemoryTool(
                currentToolUse.name,
                toolInput,
                context
              );

              yield {
                type: 'tool_result',
                toolName: currentToolUse.name,
                toolInput,
                toolResult: result,
              };

              // Continue conversation with tool result
              const continuationMessages: Anthropic.MessageParam[] = [
                ...messages,
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'tool_use',
                      id: currentToolUse.id,
                      name: currentToolUse.name,
                      input: toolInput,
                    },
                  ],
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: currentToolUse.id,
                      content: result,
                    },
                  ],
                },
              ];

              // Get continuation response
              const continuation = await this.client.messages.create({
                model: this.model,
                max_tokens: 4096,
                system: this.getSystemPrompt(),
                tools: memoryToolDefinitions,
                messages: continuationMessages,
                stream: true,
              });

              // Stream continuation
              for await (const contEvent of continuation) {
                if (contEvent.type === 'content_block_delta') {
                  if (contEvent.delta.type === 'text_delta') {
                    yield {
                      type: 'text',
                      content: contEvent.delta.text,
                    };
                  }
                }
              }
            } catch (error) {
              console.error('Tool execution error:', error);
              yield {
                type: 'error',
                content: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              };
            }

            currentToolUse = null;
          }
          break;

        case 'message_stop':
          yield { type: 'done' };
          break;
      }
    }
  }

  /**
   * Non-streaming chat for simple use cases
   */
  async chatSync(
    userMessage: string,
    context: ToolContext,
    conversationHistory: Message[] = []
  ): Promise<string> {
    let fullResponse = '';

    for await (const chunk of this.chat(userMessage, context, conversationHistory)) {
      if (chunk.type === 'text' && chunk.content) {
        fullResponse += chunk.content;
      }
    }

    return fullResponse;
  }

  /**
   * Format conversation history for API
   */
  private formatHistory(history: Message[]): Anthropic.MessageParam[] {
    return history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
  }
}

// Singleton instance
let agentInstance: AssistantAgent | null = null;

export function getAssistantAgent(): AssistantAgent {
  if (!agentInstance) {
    agentInstance = new AssistantAgent();
  }
  return agentInstance;
}

export default AssistantAgent;
