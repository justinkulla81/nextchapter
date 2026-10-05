// Splits a .sql file into single statements so Prisma (which prepares every
// statement and refuses multi-command strings) can run it one at a time.
// Understands -- comments, '...' strings, "..." identifiers and $tag$ bodies,
// which is everything prisma/sql/*.sql uses.
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = []
  let buf = ''
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    const rest = sql.slice(i)
    if (rest.startsWith('--')) {
      const nl = sql.indexOf('\n', i)
      i = nl === -1 ? sql.length : nl + 1
      buf += '\n'
      continue
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) j += 2
        else if (sql[j] === ch) break
        else j++
      }
      buf += sql.slice(i, j + 1)
      i = j + 1
      continue
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(rest)
    if (dollar) {
      const tag = dollar[0]
      const close = sql.indexOf(tag, i + tag.length)
      if (close === -1) throw new Error(`Unterminated ${tag} body`)
      buf += sql.slice(i, close + tag.length)
      i = close + tag.length
      continue
    }
    if (ch === ';') {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      i++
      continue
    }
    buf += ch
    i++
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}
