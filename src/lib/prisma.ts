import { PrismaClient } from '@prisma/client'
import { tokenCryptoExtension } from '@/lib/security/token-crypto-extension'
import { tokenDefaultsExtension } from '@/lib/security/token-defaults-extension'

// OAuth token columns are encrypted/decrypted transparently by the extension
// (see src/lib/security/token-crypto.ts). It is a query-only extension, so the
// client's shape is unchanged; the cast keeps the exported type a plain
// PrismaClient, which helpers across the app (transactions, Db interfaces)
// are typed against.
// Prisma's default pool is 2 x CPUs + 1 (7 on a Vercel function) and waits 10 seconds for a free connection. One instance serves many requests at
// once, and a crawler hitting thousands of uncached public pages made them wait out the 10 seconds and fail with a 500 ("Timed out fetching a new
// connection from the connection pool", seen 2026-10-26). DATABASE_URL goes through Supabase's transaction pooler (pgbouncer=true), which hands out a
// server connection only for the length of a query, so a larger client-side pool and a longer wait are safe. A value already in the URL wins.
//
// During `next build` the pool is small (BUILD_POOL_SIZE) and waits longer. A build renders many pages in several worker processes at once, each
// with its own pool, so at 15 a single build could hold hundreds of the pooler's 600 client slots and, with other deploys running, push every
// real request into "max client connections reached" (a five-minute burst on 2026-10-26 rejected 7,733 connections and returned 500s to Googlebot).
export const BUILD_POOL_SIZE = 3
const isBuild = () => process.env.NEXT_PHASE === 'phase-production-build'

export function withPoolSettings(url: string | undefined, building: boolean = isBuild()): string | undefined {
  if (!url) return url
  const [base, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  if (!params.has('connection_limit')) params.set('connection_limit', String(building ? BUILD_POOL_SIZE : 15))
  if (!params.has('pool_timeout')) params.set('pool_timeout', building ? '120' : '30')
  return `${base}?${params.toString()}`
}

function createPrismaClient(): PrismaClient {
  const url = withPoolSettings(process.env.DATABASE_URL)
  return new PrismaClient(url ? { datasourceUrl: url } : undefined).$extends(tokenCryptoExtension).$extends(tokenDefaultsExtension) as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
