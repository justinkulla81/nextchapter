import { PrismaClient } from '@prisma/client'
import { tokenCryptoExtension } from '@/lib/security/token-crypto-extension'
import { tokenDefaultsExtension } from '@/lib/security/token-defaults-extension'
import { withPoolLimits } from '@/lib/db-pool-url'

// OAuth token columns are encrypted/decrypted transparently by the extension
// (see src/lib/security/token-crypto.ts). It is a query-only extension, so the
// client's shape is unchanged; the cast keeps the exported type a plain
// PrismaClient, which helpers across the app (transactions, Db interfaces)
// are typed against.
function createPrismaClient(): PrismaClient {
  return new PrismaClient({ datasourceUrl: withPoolLimits(process.env.DATABASE_URL) }).$extends(tokenCryptoExtension).$extends(tokenDefaultsExtension) as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
