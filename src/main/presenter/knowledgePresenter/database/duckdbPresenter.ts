import fs from 'node:fs'
import path from 'node:path'

import { DuckDBConnection, DuckDBInstance, arrayValue } from '@duckdb/node-api'
import {
  IndexOptions,
  InsertOptions,
  QueryOptions,
  QueryResult,
  IVectorDatabasePresenter,
  KnowledgeFileMessage,
  KnowledgeFileStatus
} from '@shared/presenter'

import { nanoid } from 'nanoid'
import { app } from 'electron'

const runtimeBasePath = path
  .join(app.getAppPath(), 'runtime')
  .replace('app.asar', 'app.asar.unpacked')
const extensionPath = path.join(runtimeBasePath, 'duckdb', 'extensions', 'vss.duckdb_extension')

export class DuckDBPresenter implements IVectorDatabasePresenter {
  private dbInstance!: DuckDBInstance
  private connection!: DuckDBConnection

  private readonly dbPath: string

  private readonly vectorTable = 'vector'
  private readonly fileTable = 'file'

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  async initialize(dimensions: number, opts?: IndexOptions): Promise<void> {
    if (fs.existsSync(this.dbPath)) {
      throw new Error('Database already exists, cannot initialize again.')
    }
    await this.connect()
    await this.installAndLoadVSS()
    await this.initVectorTable(dimensions)
    await this.initFileTable()
    await this.initIndex(opts)
  }

  async open(): Promise<void> {
    if (!fs.existsSync(this.dbPath)) {
      throw new Error('Database does not exist, please initialize first.')
    }
    await this.connect()
    await this.installAndLoadVSS()
  }

  async close(): Promise<void> {
    try {
      if (this.connection) {
        this.connection.closeSync()
      }
      if (this.dbInstance) {
        this.dbInstance.closeSync()
      }
      console.log('DuckDB connection closed')
    } catch (err) {
      console.error('[DuckDB Close Error]', err)
    }
  }

  /**
   * 统一安全 SQL 执行，自动捕获异常并输出日志
   */
  private async safeRun(sql: string, params?: any[]): Promise<any> {
    try {
      if (!this.connection) await this.connect()
      if (params) {
        return await this.connection.run(sql, params)
      } else {
        return await this.connection.run(sql)
      }
    } catch (err) {
      console.error('[DuckDB SQL Error]', sql, params, err)
      throw err
    }
  }

  private async connect() {
    this.dbInstance = await DuckDBInstance.create(this.dbPath)
    this.connection = await this.dbInstance.connect()
    console.log(`Connected to DuckDB at ${this.dbPath}`)
  }

  /** 安装并加载 VSS 扩展 */
  private async installAndLoadVSS(): Promise<void> {
    if (fs.existsSync(extensionPath)) {
      const escapedPath = extensionPath.replace(/\\/g, '\\\\')
      await this.safeRun(`LOAD '${escapedPath}';`)
    } else {
      await this.safeRun(`INSTALL vss;`)
      await this.safeRun(`LOAD vss;`)
    }
    await this.safeRun(`SET hnsw_enable_experimental_persistence = true;`)
  }

  /** 创建定长向量表 */
  private async initVectorTable(dimensions: number): Promise<void> {
    await this.safeRun(
      `CREATE TABLE IF NOT EXISTS ${this.vectorTable} (
         id VARCHAR PRIMARY KEY,
         embedding FLOAT[${dimensions}],
         metadata JSON,
         file_id VARCHAR
       );`
    )
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

  /** 创建索引 */
  private async initIndex(opts?: IndexOptions): Promise<void> {
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
  }

  async insertVector(opts: InsertOptions): Promise<void> {
    const id = nanoid()
    const vec = arrayValue(Array.from(opts.vector))
    const meta = opts.metadata ? JSON.stringify(opts.metadata) : null
    await this.safeRun(
      `INSERT INTO ${this.vectorTable} (id, embedding, metadata)
       VALUES (?, ?::FLOAT[], ?::JSON);`,
      [id, vec, meta]
    )
  }

  async insertVectors(records: InsertOptions[]): Promise<void> {
    if (!records.length) return
    // 构造批量插入 SQL
    const valuesSql = records.map(() => '(?, ?::FLOAT[], ?::JSON)').join(', ')
    const sql = `INSERT INTO ${this.vectorTable} (id, embedding, metadata) VALUES ${valuesSql};`
    const params: any[] = []
    for (const r of records) {
      params.push(nanoid())
      params.push(arrayValue(Array.from(r.vector)))
      params.push(r.metadata ? JSON.stringify(r.metadata) : null)
    }
    await this.safeRun(sql, params)
  }

  async similarityQuery(params: QueryOptions & { vector: number[] }): Promise<QueryResult[]> {
    const k = params.topK
    const fn =
      params.metric === 'ip'
        ? 'array_negative_inner_product'
        : params.metric === 'cosine'
          ? 'array_cosine_distance'
          : 'array_distance'
    const where = params.threshold != null ? `WHERE ${fn}(embedding, ?) <= ?` : ''
    const sql = `
      SELECT id, metadata, ${fn}(embedding, ?) AS distance
      FROM ${this.vectorTable}
      ${where}
      ORDER BY distance
      LIMIT ?;
    `
    const paramsArr: any[] = [params.vector]
    if (params.threshold != null) {
      paramsArr.push(params.vector, params.threshold)
    }
    paramsArr.push(k)
    const reader = await this.connection.runAndReadAll(sql, paramsArr)
    const rows = reader.getRowObjectsJson()
    return rows.map((r: any) => ({
      id: r.id,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      distance: r.distance
    }))
  }

  async deleteVector(id: string): Promise<void> {
    await this.safeRun(`DELETE FROM ${this.vectorTable} WHERE id = ?;`, [id])
  }

  async deleteVectorsByFile(fileId: string): Promise<void> {
    await this.safeRun(`DELETE FROM ${this.vectorTable} WHERE file_id = ?;`, [fileId])
  }

  async insertFile(file: KnowledgeFileMessage): Promise<void> {
    await this.safeRun(
      `INSERT INTO ${this.fileTable} (id, name, path, mime_type, status, uploaded_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?::JSON);`,
      [
        file.id,
        file.name,
        file.path,
        file.mimeType,
        file.status,
        String(file.uploadedAt),
        file.metadata ? JSON.stringify(file.metadata) : null
      ]
    )
  }

  async updateFileStatus(id: string, status: KnowledgeFileStatus): Promise<void> {
    await this.safeRun(`UPDATE ${this.fileTable} SET status = ? WHERE id = ?;`, [status, id])
  }

  async queryFile(id: string): Promise<KnowledgeFileMessage | null> {
    const reader = await this.connection.runAndReadAll(
      `SELECT * FROM ${this.fileTable} WHERE id = ?;`,
      [id]
    )
    const rows = reader.getRowObjectsJson()
    if (rows.length === 0) return null
    const row = rows[0]
    return this.toKnowledgeFileMessage(row)
  }

  async listFiles(): Promise<KnowledgeFileMessage[]> {
    const reader = await this.connection.runAndReadAll(
      `SELECT * FROM ${this.fileTable} ORDER BY uploaded_at DESC;`
    )
    const rows = reader.getRowObjectsJson()
    return rows.map((row) => this.toKnowledgeFileMessage(row))
  }

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

  async deleteFile(id: string): Promise<void> {
    await this.safeRun(`DELETE FROM ${this.fileTable} WHERE id = ?;`, [id])
  }

  async destroy(): Promise<void> {
    await this.close()
    // 删除数据库文件
    try {
      if (fs.existsSync(this.dbPath)) {
        fs.rmSync(this.dbPath, { recursive: true })
      }
    } catch (err) {
      console.error('[DuckDB Destroy Error]', err)
    }
  }
}