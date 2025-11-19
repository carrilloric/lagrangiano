'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, Conversation, Message, StreamChunk } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import {
  Brain,
  Send,
  Plus,
  MessageSquare,
  Trash2,
  LogOut,
  Settings,
  User,
  Bot,
  Loader2,
} from 'lucide-react';

export default function ChatPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  // Load conversations
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const loadConversations = async () => {
    try {
      const result = await api.getConversations();
      if (result.data?.conversations) {
        setConversations(result.data.conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const result = await api.getConversation(id);
      if (result.data) {
        setCurrentConversation(id);
        setMessages(result.data.messages);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const createNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations(conversations.filter(c => c.id !== id));
      if (currentConversation === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to UI
    const tempUserMessage: Message = {
      id: 'temp-user',
      conversationId: currentConversation || '',
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    setIsStreaming(true);
    setStreamingContent('');

    try {
      let fullResponse = '';

      const conversationId = await api.streamMessage(
        userMessage,
        currentConversation || undefined,
        (chunk: StreamChunk) => {
          if (chunk.type === 'text' && chunk.content) {
            fullResponse += chunk.content;
            setStreamingContent(fullResponse);
          } else if (chunk.type === 'tool_use') {
            setStreamingContent(prev => prev + `\n\n*Using tool: ${chunk.toolName}...*\n`);
          } else if (chunk.type === 'tool_result') {
            setStreamingContent(prev => prev + `\n*Tool completed*\n\n`);
          }
        }
      );

      // Update conversation ID if new
      if (!currentConversation && conversationId) {
        setCurrentConversation(conversationId);
        loadConversations();
      }

      // Add assistant message
      if (fullResponse) {
        const assistantMessage: Message = {
          id: 'temp-assistant',
          conversationId: conversationId || currentConversation || '',
          role: 'assistant',
          content: fullResponse,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error('Stream error:', err);
      setStreamingContent('Error: Failed to get response');
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "flex flex-col border-r bg-muted/30 transition-all duration-300",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-4 border-b">
          <Button
            onClick={createNewConversation}
            className="w-full justify-start"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted",
                currentConversation === conv.id && "bg-muted"
              )}
              onClick={() => loadConversation(conv.id)}
            >
              <div className="flex items-center truncate">
                <MessageSquare className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate text-sm">{conv.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <User className="w-4 h-4 mr-2" />
            <span className="truncate">{user?.name || user?.email}</span>
          </div>
          <Button
            onClick={logout}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-muted rounded-md mr-2"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <div className="flex items-center">
              <Brain className="w-5 h-5 mr-2 text-primary" />
              <h1 className="font-semibold">AI Assistant</h1>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Brain className="w-12 h-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to AI Assistant</h2>
              <p className="text-muted-foreground max-w-md">
                I have persistent memory powered by mem0. I can remember your preferences
                and context across conversations.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex items-start max-w-[80%] gap-2",
                  message.role === 'user' && "flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-full flex-shrink-0",
                    message.role === 'user' ? "bg-primary" : "bg-muted"
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-primary-foreground" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "p-3 rounded-lg",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {streamingContent && (
            <div className="flex justify-start">
              <div className="flex items-start max-w-[80%] gap-2">
                <div className="p-2 rounded-full bg-muted flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isStreaming}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
