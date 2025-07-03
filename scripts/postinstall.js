console.log('postinstall')

// install duckdb extension
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('Installing duckdb extension...')
import('@duckdb/node-api').then((m) =>
  m.DuckDBInstance.create(':memory:').then((inst) =>
    inst.connect().then(async (conn) => {
      await conn.run('INSTALL vss')
      const reader = await conn.runAndReadAll(
        "SELECT install_path FROM duckdb_extensions() WHERE extension_name = 'vss'"
      )
      const rows = reader.getRows()
      if (rows.length > 0) {
        console.log('vss extension path:', rows[0][0])
        const targetDir = path.join(__dirname, '../runtime/duckdb/extensions')
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }
        const targetPath = path.join(
          targetDir,
          rows[0][0].substring(rows[0][0].lastIndexOf(path.sep) + 1)
        )
        fs.copyFileSync(rows[0][0], targetPath)
        console.log('Install duckdb extension successfully.')
      }
    })
  )
)
