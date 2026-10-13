import { PrismaClient } from '@prisma/client'
import { tokenCryptoExtension } from '@/lib/security/token-crypto-extension'

// OAuth token columns are encrypted/decrypted transparently by the extension
// (see src/lib/security/token-crypto.ts). It is a query-only extension, so the
// client's shape is unchanged; the cast keeps the exported type a plain
// PrismaClient, which helpers across the app (transactions, Db interfaces)
// are typed against.
function createPrismaClient(): PrismaClient {
  return new PrismaClient().$extends(tokenCryptoExtension) as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
