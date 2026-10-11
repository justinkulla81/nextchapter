// Applies prisma/sql/higher-ed-rls.sql (helper functions, RLS on, policies)
// then prisma/sql/higher-ed-views.sql (HE-02 consent views), in one
// transaction. Idempotent. Run after any `prisma db push` that touches
// Higher Ed tables:
//
//   npm run he:rls
import { readFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { splitSqlStatements } from './sql-statements'

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })
  const files = ['prisma/sql/higher-ed-rls.sql', 'prisma/sql/higher-ed-views.sql']
  const statements = files.flatMap((f) => splitSqlStatements(readFileSync(path.join(process.cwd(), f), 'utf8')))
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`set local lock_timeout = '5s'`)
        for (const s of statements) await tx.$executeRawUnsafe(s)
      },
      { timeout: 60_000, maxWait: 20_000 },
    )
    console.log(`Applied ${statements.length} statements from ${files.join(', ')}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
