// Applies prisma/sql/higher-ed-rls.sql (helper functions, RLS on, policies).
// Idempotent. Run after any `prisma db push` that touches Higher Ed tables:
//
//   npm run he:rls
import { readFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { splitSqlStatements } from './sql-statements'

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })
  const sql = readFileSync(path.join(process.cwd(), 'prisma/sql/higher-ed-rls.sql'), 'utf8')
  const statements = splitSqlStatements(sql)
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`set local lock_timeout = '5s'`)
        for (const s of statements) await tx.$executeRawUnsafe(s)
      },
      { timeout: 60_000, maxWait: 20_000 },
    )
    console.log(`Applied ${statements.length} statements from higher-ed-rls.sql`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
