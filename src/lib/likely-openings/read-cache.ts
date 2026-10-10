// SecFilingRead-backed cache for Haiku reads (one row per accession number).
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CachedFilingRead, FilingReadCache } from './llm-read'

export const dbFilingReadCache: FilingReadCache = {
  async get(accessionNumber) {
    const row = await prisma.secFilingRead.findUnique({ where: { accessionNumber } })
    if (!row) return null
    return { model: row.model, result: row.result as unknown as CachedFilingRead['result'], inputTokens: row.inputTokens, outputTokens: row.outputTokens }
  },
  async set(accessionNumber, entry) {
    const data = { ...entry, result: entry.result as unknown as Prisma.InputJsonValue }
    await prisma.secFilingRead.upsert({ where: { accessionNumber }, create: { accessionNumber, ...data }, update: data })
  },
}
