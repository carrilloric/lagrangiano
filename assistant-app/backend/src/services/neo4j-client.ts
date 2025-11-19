import neo4j, { Driver, Session, Record, Node, Relationship } from 'neo4j-driver';
import { GraphNode, GraphRelationship, GraphData, D3GraphData, D3Node, D3Link } from '../types/index.js';

/**
 * Neo4j client for direct graph queries
 *
 * This client is used for visualization purposes only.
 * mem0 Platform writes to Neo4j; your backend reads from it.
 *
 * Memory flow:
 * User message → Agent SDK → mem0 API → mem0 extracts entities → mem0 writes to Neo4j
 * Visualization → Backend → Direct Neo4j query → Graph data
 */
export class Neo4jClient {
  private driver: Driver | null = null;
  private uri: string;
  private username: string;
  private password: string;

  constructor(uri?: string, username?: string, password?: string) {
    this.uri = uri || process.env.NEO4J_URI || '';
    this.username = username || process.env.NEO4J_USERNAME || 'neo4j';
    this.password = password || process.env.NEO4J_PASSWORD || '';

    if (!this.uri || !this.password) {
      console.warn('Neo4j credentials not configured. Graph visualization will be unavailable.');
    }
  }

  /**
   * Connect to Neo4j
   */
  async connect(): Promise<void> {
    if (this.driver) return;

    if (!this.uri || !this.password) {
      throw new Error('Neo4j credentials not configured');
    }

    try {
      this.driver = neo4j.driver(
        this.uri,
        neo4j.auth.basic(this.username, this.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        }
      );

      // Verify connection
      await this.driver.verifyConnectivity();
      console.log('Connected to Neo4j');
    } catch (error) {
      console.error('Failed to connect to Neo4j:', error);
      throw error;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  /**
   * Execute a Cypher query
   */
  async query<T = Record>(cypher: string, params: Record<string, unknown> = {}): Promise<T[]> {
    if (!this.driver) {
      await this.connect();
    }

    const session = this.driver!.session();
    try {
      const result = await session.run(cypher, params);
      return result.records as unknown as T[];
    } finally {
      await session.close();
    }
  }

  /**
   * Get all memories for a user as graph data
   *
   * Cypher: MATCH (n) WHERE n.user_id = $userId RETURN n LIMIT 50
   */
  async getUserMemoryGraph(userId: string, limit: number = 50): Promise<GraphData> {
    const cypher = `
      MATCH (n)
      WHERE n.user_id = $userId
      OPTIONAL MATCH (n)-[r]-(m)
      RETURN n, r, m
      LIMIT $limit
    `;

    const records = await this.query(cypher, { userId, limit });
    return this.recordsToGraphData(records);
  }

  /**
   * Get global knowledge graph
   *
   * Cypher: MATCH (n) WHERE n.user_id = 'global' RETURN n LIMIT 50
   */
  async getGlobalMemoryGraph(limit: number = 50): Promise<GraphData> {
    return this.getUserMemoryGraph('global', limit);
  }

  /**
   * Get conversation-specific graph
   *
   * Cypher: MATCH (n)-[r]-(m) WHERE n.metadata.conversation_id = $conversationId RETURN n, r, m
   */
  async getConversationGraph(conversationId: string, limit: number = 100): Promise<GraphData> {
    const cypher = `
      MATCH (n)
      WHERE n.conversation_id = $conversationId OR n.metadata.conversation_id = $conversationId
      OPTIONAL MATCH (n)-[r]-(m)
      RETURN n, r, m
      LIMIT $limit
    `;

    const records = await this.query(cypher, { conversationId, limit });
    return this.recordsToGraphData(records);
  }

  /**
   * Get entity relationships
   *
   * Cypher: MATCH (e1:Entity)-[r]->(e2:Entity) RETURN e1, r, e2 LIMIT 100
   */
  async getEntityRelationships(userId?: string, limit: number = 100): Promise<GraphData> {
    let cypher: string;
    const params: Record<string, unknown> = { limit };

    if (userId) {
      cypher = `
        MATCH (e1)-[r]->(e2)
        WHERE e1.user_id = $userId OR e2.user_id = $userId
        RETURN e1, r, e2
        LIMIT $limit
      `;
      params.userId = userId;
    } else {
      cypher = `
        MATCH (e1)-[r]->(e2)
        RETURN e1, r, e2
        LIMIT $limit
      `;
    }

    const records = await this.query(cypher, params);
    return this.recordsToGraphData(records);
  }

  /**
   * Search for entities by name
   */
  async searchEntities(searchTerm: string, limit: number = 20): Promise<GraphData> {
    const cypher = `
      MATCH (n)
      WHERE n.name CONTAINS $searchTerm OR n.memory CONTAINS $searchTerm
      OPTIONAL MATCH (n)-[r]-(m)
      RETURN n, r, m
      LIMIT $limit
    `;

    const records = await this.query(cypher, { searchTerm, limit });
    return this.recordsToGraphData(records);
  }

  /**
   * Get memory by scope with full graph context
   */
  async getMemoryGraphByScope(
    scope: 'user' | 'global' | 'conversation',
    identifier: string,
    limit: number = 50
  ): Promise<GraphData> {
    switch (scope) {
      case 'user':
        return this.getUserMemoryGraph(identifier, limit);
      case 'global':
        return this.getGlobalMemoryGraph(limit);
      case 'conversation':
        return this.getConversationGraph(identifier, limit);
      default:
        throw new Error(`Invalid scope: ${scope}`);
    }
  }

  /**
   * Convert Neo4j records to GraphData format
   */
  private recordsToGraphData(records: Record[]): GraphData {
    const nodesMap = new Map<string, GraphNode>();
    const relationshipsMap = new Map<string, GraphRelationship>();

    for (const record of records) {
      // Process each field in the record
      for (const key of record.keys) {
        const value = record.get(key);

        if (this.isNode(value)) {
          const node = this.nodeToGraphNode(value);
          nodesMap.set(node.id, node);
        } else if (this.isRelationship(value)) {
          const rel = this.relationshipToGraphRelationship(value);
          relationshipsMap.set(rel.id, rel);
        }
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      relationships: Array.from(relationshipsMap.values()),
    };
  }

  /**
   * Convert GraphData to D3.js format
   */
  toD3Format(graphData: GraphData): D3GraphData {
    const nodes: D3Node[] = graphData.nodes.map(node => ({
      id: node.id,
      label: this.getNodeLabel(node),
      type: node.labels[0] || 'Unknown',
      properties: node.properties,
    }));

    const links: D3Link[] = graphData.relationships.map(rel => ({
      source: rel.startNodeId,
      target: rel.endNodeId,
      type: rel.type,
      properties: rel.properties,
    }));

    return { nodes, links };
  }

  /**
   * Generate Cypher queries for Neo4j Browser exploration
   */
  getCypherQueries(scope: 'user' | 'global' | 'conversation', identifier: string): Record<string, string> {
    const queries: Record<string, string> = {};

    switch (scope) {
      case 'user':
        queries['All user memories'] = `MATCH (n) WHERE n.user_id = '${identifier}' RETURN n LIMIT 50`;
        queries['User relationships'] = `MATCH (n)-[r]-(m) WHERE n.user_id = '${identifier}' RETURN n, r, m LIMIT 100`;
        queries['User entities'] = `MATCH (e:Entity) WHERE e.user_id = '${identifier}' RETURN e LIMIT 50`;
        break;

      case 'global':
        queries['All global memories'] = `MATCH (n) WHERE n.user_id = 'global' RETURN n LIMIT 50`;
        queries['Global relationships'] = `MATCH (n)-[r]-(m) WHERE n.user_id = 'global' RETURN n, r, m LIMIT 100`;
        queries['Global knowledge'] = `MATCH (e:Entity)-[r]->(e2:Entity) WHERE e.user_id = 'global' RETURN e, r, e2 LIMIT 100`;
        break;

      case 'conversation':
        queries['Conversation memories'] = `MATCH (n) WHERE n.conversation_id = '${identifier}' RETURN n LIMIT 50`;
        queries['Conversation graph'] = `MATCH (n)-[r]-(m) WHERE n.conversation_id = '${identifier}' RETURN n, r, m LIMIT 100`;
        queries['Conversation entities'] = `MATCH (e:Entity) WHERE e.conversation_id = '${identifier}' RETURN e LIMIT 50`;
        break;
    }

    return queries;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<Record<string, number>> {
    const nodeCountResult = await this.query('MATCH (n) RETURN count(n) as count');
    const relCountResult = await this.query('MATCH ()-[r]->() RETURN count(r) as count');
    const labelCountResult = await this.query('CALL db.labels() YIELD label RETURN count(label) as count');

    return {
      nodes: (nodeCountResult[0] as any)?.get('count')?.toNumber() || 0,
      relationships: (relCountResult[0] as any)?.get('count')?.toNumber() || 0,
      labels: (labelCountResult[0] as any)?.get('count')?.toNumber() || 0,
    };
  }

  // Helper methods
  private isNode(value: unknown): value is Node {
    return value !== null && typeof value === 'object' && 'labels' in value && 'properties' in value;
  }

  private isRelationship(value: unknown): value is Relationship {
    return value !== null && typeof value === 'object' && 'type' in value && 'start' in value && 'end' in value;
  }

  private nodeToGraphNode(node: Node): GraphNode {
    return {
      id: node.elementId || node.identity.toString(),
      labels: node.labels,
      properties: node.properties as Record<string, unknown>,
    };
  }

  private relationshipToGraphRelationship(rel: Relationship): GraphRelationship {
    return {
      id: rel.elementId || rel.identity.toString(),
      type: rel.type,
      startNodeId: rel.startNodeElementId || rel.start.toString(),
      endNodeId: rel.endNodeElementId || rel.end.toString(),
      properties: rel.properties as Record<string, unknown>,
    };
  }

  private getNodeLabel(node: GraphNode): string {
    return (node.properties.name as string) ||
      (node.properties.memory as string)?.substring(0, 50) ||
      node.labels[0] ||
      'Unknown';
  }
}

// Singleton instance
let neo4jClientInstance: Neo4jClient | null = null;

export function getNeo4jClient(): Neo4jClient {
  if (!neo4jClientInstance) {
    neo4jClientInstance = new Neo4jClient();
  }
  return neo4jClientInstance;
}

export default Neo4jClient;
