import fs from 'node:fs'
import path from 'node:path'

import { DuckDBInstance } from '@duckdb/node-api'
import {
  IndexOptions,
  InsertOptions,
  QueryOptions,
  QueryResult,
  IVectorDatabasePresenter
} from '@shared/presenter'

import { nanoid } from 'nanoid'
import { app } from 'electron'

const runtimeBasePath = path
  .join(app.getAppPath(), 'runtime')
  .replace('app.asar', 'app.asar.unpacked')
const extensionPath = path.join(runtimeBasePath, 'duckdb', 'extensions', 'vss.duckdb_extension')

export class DuckDBPresenter implements IVectorDatabasePresenter {
  private dbInstance: any
  private connection: any
  private readonly path: string
  private readonly dimension: number
  private readonly table = 'vectors'

  constructor(path: string, dimension: number) {
    this.path = path
    this.dimension = dimension
    void this.init()
  }

  private async init() {
    await this.connect()
    await this.installAndLoadVSS()
    await this.initTable()
    await this.initIndex()
  }

  private async connect() {
    this.dbInstance = await DuckDBInstance.create(this.path)
    this.connection = await this.dbInstance.connect()
    console.log(`Connected to DuckDB at ${this.path}`)
  }

  /** 安装并加载 VSS 扩展 */
  private async installAndLoadVSS(): Promise<void> {
    if (!this.connection) await this.connect()
    if (!fs.existsSync(extensionPath)) {
      await this.connection.run(`LOAD '${extensionPath}';`)
    } else {
      await this.connection.run(`INSTALL vss;`)
      await this.connection.run(`LOAD vss;`)
    }
    await this.connection.run(`SET hnsw_enable_experimental_persistence = true;`)
  }

  /** 创建定长向量表 */
  private async initTable(): Promise<void> {
    if (!this.connection) await this.connect()
    await this.connection.run(
      `CREATE TABLE IF NOT EXISTS ${this.table} (
         id VARCHAR PRIMARY KEY,
         embedding FLOAT[${this.dimension}],
         metadata JSON
       );`
    )
  }

  /** 创建 HNSW 索引 */
  private async initIndex(opts?: IndexOptions): Promise<void> {
    if (!this.connection) await this.connect()
    const metric = opts?.metric || 'cosine' // 支持 'l2sq' | 'cosine' | 'ip'
    const M = opts?.M || 16
    const efConstruction = opts?.efConstruction || 200

    await this.connection.run(
      `CREATE INDEX IF NOT EXISTS idx_${this.table}_emb
         ON ${this.table}
         USING HNSW (embedding)
         WITH (
           metric='${metric}',
           M=${M},
           ef_construction=${efConstruction}
         );`
    )
  }

  public async insert(opts: InsertOptions): Promise<void> {
    const id = nanoid()
    const vecLiteral = `[${opts.vector.join(',')}]::FLOAT[${this.dimension}]`
    const meta = opts.metadata ? JSON.stringify(opts.metadata) : null
    await this.connection.run(
      `INSERT INTO ${this.table} (id, embedding, metadata)
       VALUES (?, ?, ?::JSON);`,
      [id, vecLiteral, meta]
    )
  }

  public async bulkInsert(records: InsertOptions[]): Promise<void> {
    if (!this.connection) await this.connect()
    if (!records.length) return
    const sql = `INSERT INTO ${this.table} (id, embedding, metadata) VALUES (?, ?, ?::JSON);`
    for (const r of records) {
      const id = nanoid()
      const vecLiteral = `[${r.vector.join(',')}]::FLOAT[${this.dimension}]`
      const meta = r.metadata ? JSON.stringify(r.metadata) : null
      await this.connection.run(sql, [id, vecLiteral, meta])
    }
  }

  public async query(params: QueryOptions & { vector: number[] }): Promise<QueryResult[]> {
    const k = params.topK
    const vecLiteral = `[${params.vector.join(',')}]::FLOAT[${this.dimension}]`
    const fn =
      params.metric === 'ip'
        ? 'array_negative_inner_product'
        : params.metric === 'cosine'
          ? 'array_cosine_distance'
          : 'array_distance'
    const where =
      params.threshold != null ? `WHERE ${fn}(embedding, ${vecLiteral}) <= ${params.threshold}` : ''
    const sql = `
    SELECT id, metadata, ${fn}(embedding, ${vecLiteral}) AS distance
      FROM ${this.table}
      ${where}
    ORDER BY distance
    LIMIT ${k};
  `
    const reader = await this.connection.runAndReadAll(sql)
    const rows = reader.getRowObjectsJson() as Array<QueryResult>
    return rows.map((r) => ({
      id: r.id,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      distance: r.distance
    }))
  }

  public async deleteById(id: string): Promise<void> {
    if (!this.connection) await this.connect()
    await this.connection.run(`DELETE FROM ${this.table} WHERE id = ?;`, [id])
  }

  public async close(): Promise<void> {
    if (this.connection) {
      this.connection.closeSync()
      this.connection = null
    }
    if (this.dbInstance) {
      this.dbInstance.closeSync()
      this.dbInstance = null
    }
    console.log('DuckDB connection closed')
  }

  public async destory(): Promise<void> {
    await this.close()
    // 删除数据库文件
    if (fs.existsSync(this.path)) {
      fs.rmSync(this.path, { recursive: true })
    }
  }
}
