import Database from 'better-sqlite3';
import { User, Conversation, Message } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * SQLite database for users, conversations, and messages
 */
export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(__dirname, '../../data/app.db');
    this.db = new Database(dbPath || defaultPath);
    this.init();
  }

  private init(): void {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    `);
  }

  // User operations

  async createUser(email: string, password: string, name: string): Promise<User> {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, email, passwordHash, name);

    return this.getUserById(id)!;
  }

  getUserById(id: string): User | undefined {
    const stmt = this.db.prepare(`
      SELECT id, email, password_hash as passwordHash, name, created_at as createdAt, updated_at as updatedAt
      FROM users WHERE id = ?
    `);

    return stmt.get(id) as User | undefined;
  }

  getUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare(`
      SELECT id, email, password_hash as passwordHash, name, created_at as createdAt, updated_at as updatedAt
      FROM users WHERE email = ?
    `);

    return stmt.get(email) as User | undefined;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  // Conversation operations

  createConversation(userId: string, title: string = 'New Conversation'): Conversation {
    const id = uuidv4();

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, user_id, title)
      VALUES (?, ?, ?)
    `);

    stmt.run(id, userId, title);

    return this.getConversationById(id)!;
  }

  getConversationById(id: string): Conversation | undefined {
    const stmt = this.db.prepare(`
      SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt
      FROM conversations WHERE id = ?
    `);

    return stmt.get(id) as Conversation | undefined;
  }

  getUserConversations(userId: string): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt
      FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `);

    return stmt.all(userId) as Conversation[];
  }

  updateConversationTitle(id: string, title: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET title = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(title, id);
  }

  deleteConversation(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM conversations WHERE id = ?`);
    stmt.run(id);
  }

  // Message operations

  addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string): Message {
    const id = uuidv4();

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, conversationId, role, content);

    // Update conversation timestamp
    const updateStmt = this.db.prepare(`
      UPDATE conversations
      SET updated_at = datetime('now')
      WHERE id = ?
    `);
    updateStmt.run(conversationId);

    return this.getMessageById(id)!;
  }

  getMessageById(id: string): Message | undefined {
    const stmt = this.db.prepare(`
      SELECT id, conversation_id as conversationId, role, content, created_at as createdAt
      FROM messages WHERE id = ?
    `);

    return stmt.get(id) as Message | undefined;
  }

  getConversationMessages(conversationId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, conversation_id as conversationId, role, content, created_at as createdAt
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `);

    return stmt.all(conversationId) as Message[];
  }

  getRecentMessages(conversationId: string, limit: number = 50): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, conversation_id as conversationId, role, content, created_at as createdAt
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const messages = stmt.all(conversationId, limit) as Message[];
    return messages.reverse(); // Return in chronological order
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null;

export function getDatabase(): DatabaseService {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
}

export default DatabaseService;
