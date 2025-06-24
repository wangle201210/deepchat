/* import {
  BaseVectorDatabase,
  ExtractChunkData,
  InsertChunkData
} from '@llm-tools/embedjs-interfaces'
import { DuckDBConnection } from '@duckdb/node-api'

export class DuckDB implements BaseVectorDatabase {
  private readonly tableName
  connection: DuckDBConnection | undefined
  constructor({ path, tableName }: { path: string; tableName?: string }) {
    this.tableName = tableName || 'vectors'
  }

  async init({ dimensions }: { dimensions: number }): Promise<void> {
  }
  insertChunks(chunks: InsertChunkData[]): Promise<number> {
    throw new Error('Method not implemented.')
  }
  similaritySearch(query: number[], k: number): Promise<ExtractChunkData[]> {
    throw new Error('Method not implemented.')
  }
  getVectorCount(): Promise<number> {
    throw new Error('Method not implemented.')
  }
  deleteKeys(uniqueLoaderId: string): Promise<boolean> {
    throw new Error('Method not implemented.')
  }
  reset(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
 */