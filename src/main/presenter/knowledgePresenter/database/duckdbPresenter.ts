import fs from 'node:fs'
import path from 'node:path'

import { DuckDBConnection, DuckDBInstance, arrayValue } from '@duckdb/node-api'
import {
  IndexOptions,
  VectorInsertOptions,
  QueryOptions,
  QueryResult,
  IVectorDatabasePresenter,
  KnowledgeFileMessage,
  KnowledgeChunkMessage,
  KnowledgeChunkStatus
} from '@shared/presenter'

import { nanoid } from 'nanoid'
import { app } from 'electron'

const runtimeBasePath = path
  .join(app.getAppPath(), 'runtime')
  .replace('app.asar', 'app.asar.unpacked')
const extensionPath = path.join(runtimeBasePath, 'duckdb', 'extensions', 'vss.duckdb_extension')

export class DuckDBPresenter implements IVectorDatabasePresenter {
  private transactionLevel = 0

  private dbInstance!: DuckDBInstance
  private connection!: DuckDBConnection

  private readonly dbPath: string

  private readonly vectorTable = 'vector'
  private readonly fileTable = 'file'
  private readonly chunkTable = 'chunk'

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  async initialize(dimensions: number, opts?: IndexOptions): Promise<void> {
    try {
      console.log(`[DuckDB] Initializing DuckDB database at ${this.dbPath}`)
      if (fs.existsSync(this.dbPath)) {
        console.error(`[DuckDB] Database ${this.dbPath} already exists`)
        throw new Error('Database already exists, cannot initialize again.')
      }
      console.log(`[DuckDB] connect to db`)
      await this.connect()
      console.log(`[DuckDB] load vss extension`)
      await this.installAndLoadVSS()
      console.log(`[DuckDB] create file table`)
      await this.initFileTable()
      console.log(`[DuckDB] create chunk table`)
      await this.initChunkTable()
      console.log(`[DuckDB] create vector table`)
      await this.initVectorTable(dimensions)
      console.log(`[DuckDB] create vector index`)
      await this.initTableIndex(opts)
    } catch (error) {
      console.error('[DuckDB] initialization failed:', error)
      this.close()
    }
  }

  async open(): Promise<void> {
    if (!fs.existsSync(this.dbPath)) {
      console.error(`[DuckDB] Database ${this.dbPath} does not exist`)
      throw new Error('Database does not exist, please initialize first.')
    }
    console.log(`[DuckDB] connect to db`)
    await this.connect()
    console.log(`[DuckDB] checkpoint`)
    await this.connection.run('CHECKPOINT;')
    console.log(`[DuckDB] load vss extension`)
    await this.installAndLoadVSS()
    console.log(`[DuckDB] clear dirty data`)
    await this.clearDirtyData()
  }

  async close(): Promise<void> {
    try {
      if (this.connection) {
        this.connection.closeSync()
      }
      if (this.dbInstance) {
        this.dbInstance.closeSync()
      }
      console.log('[DuckDB] DuckDB connection closed')
    } catch (err) {
      console.error('[DuckDB] close error', err)
    }
  }

  async destroy(): Promise<void> {
    await this.close()
    // 删除数据库文件
    try {
      if (fs.existsSync(this.dbPath)) {
        fs.rmSync(this.dbPath, { recursive: true })
        console.log(`[DuckDB] Database at ${this.dbPath} destroyed.`)
      }
    } catch (err) {
      console.error(`[DuckDB] Error destroying database at ${this.dbPath}:`, err)
    }
  }

  // ==================== IVectorDatabasePresenter 接口实现 ====================

  async insertFile(file: KnowledgeFileMessage): Promise<void> {
    const sql = `
        INSERT INTO ${this.fileTable} (id, name, path, mime_type, status, uploaded_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `
    await this.executeInTransaction(async () => {
      await this.safeRun(sql, [
        file.id,
        file.name,
        file.path,
        file.mimeType,
        file.status,
        file.uploadedAt,
        JSON.stringify(file.metadata)
      ])
    })
  }

  async updateFile(file: KnowledgeFileMessage): Promise<void> {
    const sql = `
        UPDATE ${this.fileTable}
        SET name = ?, path = ?, mime_type = ?, status = ?, uploaded_at = ?, metadata = ?
        WHERE id = ?;
      `
    await this.executeInTransaction(async () => {
      await this.safeRun(sql, [
        file.name,
        file.path,
        file.mimeType,
        file.status,
        file.uploadedAt,
        JSON.stringify(file.metadata),
        file.id
      ])
    })
  }

  async queryFile(id: string): Promise<KnowledgeFileMessage | null> {
    const sql = `SELECT * FROM ${this.fileTable} WHERE id = ?;`
    try {
      const reader = await this.connection.runAndReadAll(sql, [id])
      const rows = reader.getRowObjectsJson()
      if (rows.length === 0) return null
      const row = rows[0]
      return this.toKnowledgeFileMessage(row)
    } catch (err) {
      console.error('[DuckDB] queryFile error', sql, id, err)
      throw err
    }
  }

  async queryFiles(where: Partial<KnowledgeFileMessage>): Promise<KnowledgeFileMessage[]> {
    const camelToSnake = (key: string) =>
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

    const entries = Object.entries(where).filter(([, value]) => value !== undefined)

    let sql = `SELECT * FROM ${this.fileTable}`
    const params: any[] = []

    if (entries.length > 0) {
      const conditions = entries.map(([key]) => `${camelToSnake(key)} = ?`).join(' AND ')
      sql += ` WHERE ${conditions}`
      params.push(...entries.map(([, value]) => value))
    }

    sql += ` ORDER BY uploaded_at DESC;`

    try {
      const reader = await this.connection.runAndReadAll(sql, params)
      const rows = reader.getRowObjectsJson()
      return rows.map((row) => this.toKnowledgeFileMessage(row))
    } catch (err) {
      console.error('[DuckDB] queryFiles error', sql, params, err)
      throw err
    }
  }

  async listFiles(): Promise<KnowledgeFileMessage[]> {
    const sql = `SELECT * FROM ${this.fileTable} ORDER BY uploaded_at DESC;`
    try {
      const reader = await this.connection.runAndReadAll(sql)
      const rows = reader.getRowObjectsJson()
      return rows.map((row) => this.toKnowledgeFileMessage(row))
    } catch (err) {
      console.error('[DuckDB] listFiles error', sql, err)
      throw err
    }
  }

  async deleteFile(id: string): Promise<void> {
    await this.executeInTransaction(async () => {
      await this.safeRun(`DELETE FROM ${this.chunkTable} WHERE file_id = ?;`, [id])
      await this.safeRun(`DELETE FROM ${this.vectorTable} WHERE file_id = ?;`, [id])
      await this.safeRun(`DELETE FROM ${this.fileTable} WHERE id = ?;`, [id])
    })
  }

  async insertChunks(chunks: KnowledgeChunkMessage[]): Promise<void> {
    if (!chunks.length) return
    const valuesSql = chunks.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    const sql = `INSERT INTO ${this.chunkTable} (id, file_id, chunk_index, content, status, error) VALUES ${valuesSql};`
    const params: any[] = []
    for (const chunk of chunks) {
      params.push(
        chunk.id,
        chunk.fileId,
        chunk.chunkIndex,
        chunk.content,
        chunk.status,
        chunk.error ?? ''
      )
    }
    await this.executeInTransaction(async () => {
      await this.safeRun(sql, params)
    })
  }

  async updateChunkStatus(
    chunkId: string,
    status: KnowledgeChunkStatus,
    error?: string
  ): Promise<void> {
    await this.executeInTransaction(async () => {
      await this.safeRun(`UPDATE ${this.chunkTable} SET status = ?, error = ? WHERE id = ?;`, [
        status,
        error ?? '',
        chunkId
      ])
    })
  }

  async insertVector(opts: VectorInsertOptions): Promise<void> {
    // 查询文件是否存在
    const file = await this.queryFile(opts.fileId)
    if (!file) {
      throw new Error(`File with ID ${opts.fileId} does not exist`)
    }
    const vec = arrayValue(Array.from(opts.vector))
    await this.executeInTransaction(async () => {
      await this.safeRun(
        `INSERT INTO ${this.vectorTable} (id, embedding, file_id, chunk_id)
         VALUES (?, ?::FLOAT[], ?, ?);`,
        [nanoid(), vec, opts.fileId, opts.chunkId]
      )
    })
  }

  async insertVectors(records: VectorInsertOptions[]): Promise<void> {
    if (!records.length) return
    // 构造批量插入 SQL
    const valuesSql = records.map(() => '(?, ?::FLOAT[], ?, ?)').join(', ')
    const sql = `INSERT INTO ${this.vectorTable} (id, embedding, file_id, chunk_id) VALUES ${valuesSql};`
    const params: any[] = []
    for (const r of records) {
      params.push(nanoid())
      params.push(arrayValue(Array.from(r.vector)))
      params.push(r.fileId)
      params.push(r.chunkId)
    }
    await this.executeInTransaction(async () => {
      await this.safeRun(sql, params)
    })
  }

  async similarityQuery(vector: number[], options: QueryOptions): Promise<QueryResult[]> {
    const k = options.topK
    const fn =
      options.metric === 'ip'
        ? 'array_negative_inner_product'
        : options.metric === 'cosine'
          ? 'array_cosine_distance'
          : 'array_distance'
    const sql = `
      SELECT t.id as id, ${fn}(embedding, ?) AS distance, t1.content as content, t2.name as name, t2.path as path
      FROM ${this.vectorTable} t
      LEFT JOIN ${this.chunkTable} t1 ON t1.id = t.chunk_id
      LEFT JOIN ${this.fileTable} t2 ON t2.id = t.file_id
      ORDER BY distance
      LIMIT ?;
    `
    const embParam = arrayValue(Array.from(vector))
    const paramsArr: any[] = [embParam]
    if (options.threshold != null) {
      paramsArr.push(options.threshold)
    }
    paramsArr.push(k)
    try {
      const reader = await this.connection.runAndReadAll(sql, paramsArr)
      const rows = reader.getRowObjectsJson()
      return rows.map((r: any) => ({
        id: r.id,
        distance: r.distance,
        metadata: {
          from: r.name,
          filePath: r.path,
          content: r.content
        }
      }))
    } catch (err) {
      console.error('[DuckDB] similarityQuery error', sql, paramsArr, err)
      throw err
    }
  }

  async deleteVectorsByFile(fileId: string): Promise<void> {
    await this.executeInTransaction(async () => {
      await this.safeRun(`DELETE FROM ${this.vectorTable} WHERE file_id = ?;`, [fileId])
    })
  }

  async queryChunk(chunkId: string): Promise<KnowledgeChunkMessage | null> {
    const sql = `SELECT * FROM ${this.chunkTable} WHERE id = ?;`
    try {
      const reader = await this.connection.runAndReadAll(sql, [chunkId])
      const rows = reader.getRowObjectsJson()
      if (rows.length === 0) return null
      const row = rows[0]
      return this.toKnowledgeChunkMessage(row)
    } catch (err) {
      console.error('[DuckDB] queryChunk error', sql, chunkId, err)
      throw err
    }
  }

  async queryChunksByFile(
    fileId: string,
    status?: KnowledgeChunkStatus
  ): Promise<KnowledgeChunkMessage[]> {
    let sql = `SELECT * FROM ${this.chunkTable} WHERE file_id = ?`
    const params: any[] = [fileId]

    if (status) {
      sql += ` AND status = ?`
      params.push(status)
    }

    sql += ` ORDER BY chunk_index;`

    try {
      const reader = await this.connection.runAndReadAll(sql, params)
      const rows = reader.getRowObjectsJson()
      return rows.map((row) => this.toKnowledgeChunkMessage(row))
    } catch (err) {
      console.error('[DuckDB] queryChunksByFile error', sql, params, err)
      throw err
    }
  }

  async deleteChunksByFile(fileId: string): Promise<void> {
    await this.executeInTransaction(async () => {
      await this.safeRun(`DELETE FROM ${this.chunkTable} WHERE file_id = ?;`, [fileId])
    })
  }

  // ==================== 转换工具 ====================

  private toKnowledgeFileMessage(o: any): KnowledgeFileMessage {
    return {
      id: o.id,
      name: o.name,
      path: o.path,
      mimeType: o.mime_type,
      status: o.status,
      uploadedAt: Number(o.uploaded_at),
      metadata: typeof o.metadata === 'string' ? JSON.parse(o.metadata) : o.metadata
    }
  }

  private toKnowledgeChunkMessage(o: any): KnowledgeChunkMessage {
    return {
      id: o.id,
      fileId: o.file_id,
      chunkIndex: o.chunk_index,
      content: o.content,
      status: o.status,
      error: o.error
    }
  }

  // ==================== 事务管理 ====================

  private async beginTransaction(): Promise<void> {
    if (this.transactionLevel === 0) {
      await this.safeRun('BEGIN TRANSACTION;')
    }
    this.transactionLevel++
  }

  private async commitTransaction(): Promise<void> {
    this.transactionLevel--
    if (this.transactionLevel === 0) {
      await this.safeRun('COMMIT;')
    }
  }

  private async rollbackTransaction(): Promise<void> {
    if (this.transactionLevel > 0) {
      await this.safeRun('ROLLBACK;')
      this.transactionLevel = 0
    }
  }

  private async executeInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.beginTransaction()
    try {
      const result = await operation()
      await this.commitTransaction()
      return result
    } catch (error) {
      await this.rollbackTransaction()
      throw error
    }
  }

  private async safeRun(sql: string, params?: any[]): Promise<any> {
    try {
      if (!this.connection) await this.connect()
      if (params) {
        return await this.connection.run(sql, params)
      } else {
        return await this.connection.run(sql)
      }
    } catch (err) {
      console.error('[DuckDB] sql error', sql, params, err)
      throw err
    }
  }

  // ==================== 初始化相关 ====================

  private async connect() {
    this.dbInstance = await DuckDBInstance.create(this.dbPath)
    this.connection = await this.dbInstance.connect()
    console.log(`[DuckDB] Connected to DuckDB at ${this.dbPath}`)
  }

  /** 安装并加载 VSS 扩展 */
  private async installAndLoadVSS(): Promise<void> {
    if (fs.existsSync(extensionPath)) {
      const escapedPath = extensionPath.replace(/\\/g, '\\\\')
      console.log(`[DuckDB] LOAD VSS extension from ${escapedPath}`)
      await this.safeRun(`LOAD '${escapedPath}';`)
    } else {
      console.log('[DuckDB] LOAD VSS extension online')
      await this.safeRun(`INSTALL vss;`)
      await this.safeRun(`LOAD vss;`)
    }
    await this.safeRun(`SET hnsw_enable_experimental_persistence = true;`)
  }

  /** 创建文件元数据表 */
  private async initFileTable(): Promise<void> {
    await this.safeRun(
      `CREATE TABLE IF NOT EXISTS ${this.fileTable} (
        id VARCHAR PRIMARY KEY,
        name VARCHAR,
        path VARCHAR,
        mime_type VARCHAR,
        status VARCHAR,
        uploaded_at BIGINT,
        metadata JSON
      );`
    )
  }

  /** 创建chunks表 */
  private async initChunkTable(): Promise<void> {
    await this.safeRun(
      `CREATE TABLE IF NOT EXISTS ${this.chunkTable} (
        id VARCHAR PRIMARY KEY,
        file_id VARCHAR,
        content TEXT,
        status VARCHAR,
        chunk_index INTEGER,
        error VARCHAR
      );`
    )
  }

  /** 创建定长向量表 */
  private async initVectorTable(dimensions: number): Promise<void> {
    await this.safeRun(
      `CREATE TABLE IF NOT EXISTS ${this.vectorTable} (
         id VARCHAR PRIMARY KEY,
         embedding FLOAT[${dimensions}],
         file_id VARCHAR,
         chunk_id VARCHAR
       );`
    )
  }

  /** 创建索引 */
  private async initTableIndex(opts?: IndexOptions): Promise<void> {
    // file
    await this.safeRun(
      `CREATE INDEX IF NOT EXISTS idx_${this.fileTable}_file_id ON ${this.fileTable} (id);`
    )
    await this.safeRun(
      `CREATE INDEX IF NOT EXISTS idx_${this.fileTable}_file_status ON ${this.fileTable} (status);`
    )
    await this.safeRun(
      `CREATE INDEX IF NOT EXISTS idx_${this.fileTable}_file_path ON ${this.fileTable} (path);`
    )
    // chunk
    await this.safeRun(
      `CREATE INDEX IF NOT EXISTS idx_${this.chunkTable}_chunk_id ON ${this.chunkTable} (id);`
    )
    await this.safeRun(
      `CREATE INDEX IF NOT EXISTS idx_${this.chunkTable}_file_id ON ${this.chunkTable} (file_id);`
    )
    await this.safeRun(
      `CREATE INDEX IF NOT EXISTS idx_${this.chunkTable}_status ON ${this.chunkTable} (status);`
    )
    // vector
    const metric = opts?.metric || 'cosine' // 支持 'l2sq' | 'cosine' | 'ip'
    const M = opts?.M || 16
    const efConstruction = opts?.efConstruction || 200
    const sql = `CREATE INDEX IF NOT EXISTS idx_${this.vectorTable}_emb
     ON ${this.vectorTable}
     USING HNSW (embedding)
     WITH (
       metric='${metric}',
       M=${M},
       ef_construction=${efConstruction}
     );`
    await this.safeRun(sql)
    await this.safeRun(
      `CREATE INDEX IF NOT EXISTS idx_${this.vectorTable}_file_id ON ${this.vectorTable} (file_id);`
    )
    await this.safeRun(
      `CREATE INDEX IF NOT EXISTS idx_${this.vectorTable}_chunk_id ON ${this.vectorTable} (chunk_id);`
    )
  }

  /** 清理异常任务引入的脏数据 */
  private async clearDirtyData(): Promise<void> {
    // 清理向量表中没有对应文件的向量
    await this.safeRun(`
      DELETE FROM ${this.vectorTable}
      WHERE file_id NOT IN (SELECT id FROM ${this.fileTable});
    `)

    // 清理chunks表中没有对应文件的分块
    await this.safeRun(`
      DELETE FROM ${this.chunkTable}
      WHERE file_id NOT IN (SELECT id FROM ${this.fileTable});
    `)
  }
}
