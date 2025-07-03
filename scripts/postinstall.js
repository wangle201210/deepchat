console.log('postinstall')

console.log('installing duckdb extension')

import("@duckdb/node-api")
.then((m) =>m.DuckDBInstance.create(":memory:")
.then((inst) =>inst.connect()
.then((conn) =>conn.run("INSTALL vss"))))
.then(() => {
    
});