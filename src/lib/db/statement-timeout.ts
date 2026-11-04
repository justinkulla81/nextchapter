import 'server-only'
import type { PrismaPromise } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * How long a member-facing or public page may wait on one database statement. The database default is 120 s
 * (it is what let one slow query hold a connection for two minutes on 2026-11-04); crons keep that long limit
 * by simply not using this helper.
 */
export const MEMBER_STATEMENT_TIMEOUT_MS = 8_000

/**
 * Runs one Prisma query (ORM call or $queryRaw) with a statement timeout that applies to that query only.
 * `set_config(..., true)` is transaction-local, so it is safe through the transaction pooler: the setting
 * never leaks onto the shared connection. Costs one extra statement; use it on the few queries that scan
 * the job board, not on every read.
 */
export async function withStatementTimeout<T>(query: PrismaPromise<T>, ms: number = MEMBER_STATEMENT_TIMEOUT_MS): Promise<T> {
  const [, result] = await prisma.$transaction([prisma.$queryRaw`SELECT set_config('statement_timeout', ${String(Math.round(ms))}, true)`, query])
  return result as T
}
