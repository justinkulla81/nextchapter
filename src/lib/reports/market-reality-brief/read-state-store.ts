import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ReadState } from './weekly-change'

// Reads and writes of the saved weekly read. Fail soft by design: until
// prisma/manual/2026-10-19-market-reality-read-state.sql is applied the table does not
// exist, and the report must keep working without a "what changed" note rather than fail.

function valid(v: unknown): v is ReadState {
  return !!v && typeof v === 'object' && (v as ReadState).v === 1 && typeof (v as ReadState).statuses === 'object'
}

/** The most recent saved read from a week before `before`, or null. */
export async function previousReadState(candidateId: string, before: Date): Promise<{ state: ReadState; weekStartDate: Date } | null> {
  try {
    const row = await prisma.marketRealityReadState.findFirst({
      where: { candidateId, weekStartDate: { lt: before } },
      orderBy: { weekStartDate: 'desc' },
      select: { state: true, weekStartDate: true },
    })
    return row && valid(row.state) ? { state: row.state, weekStartDate: row.weekStartDate } : null
  } catch (error) {
    console.error('Read state unavailable (is the table applied?):', error)
    return null
  }
}

export async function hasReadState(candidateId: string, weekStartDate: Date): Promise<boolean> {
  try {
    return (await prisma.marketRealityReadState.count({ where: { candidateId, weekStartDate } })) > 0
  } catch {
    return false
  }
}

/** Saves this week's read. The latest save in a week wins. */
export async function saveReadState(candidateId: string, weekStartDate: Date, state: ReadState): Promise<void> {
  try {
    const json = state as unknown as Prisma.InputJsonValue
    await prisma.marketRealityReadState.upsert({
      where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
      create: { candidateId, weekStartDate, state: json },
      update: { state: json },
    })
  } catch (error) {
    console.error('Could not save read state:', error)
  }
}
