import 'server-only'
import { sharedLoad } from '@/lib/db/heavy'
import { prisma } from '@/lib/prisma'
import { buildAliasIndex, resolveSkillIds, type AliasIndex } from '@/lib/careers/skill-aliases'

const TTL_MS = 60 * 60 * 1000
let memo: { at: number; value: Promise<AliasIndex> } | null = null

async function load(): Promise<AliasIndex> {
  try {
    // Shared across instances for a day: the aliases change only when the importer runs (2026-11-17 egress).
    return buildAliasIndex(await sharedLoad('skill-aliases-v1', 24 * 3600, () => prisma.skillAlias.findMany({ select: { alias: true, skillId: true } }), { reviveDates: false }))
  } catch (error) {
    // No table or no rows yet: matching falls back to plain name matching.
    console.error('Skill aliases unavailable:', error)
    return buildAliasIndex([])
  }
}

export function getAliasIndex(): Promise<AliasIndex> {
  const now = Date.now()
  if (!memo || now - memo.at > TTL_MS) memo = { at: now, value: load() }
  return memo.value
}

/** Skill ids the given resume keywords evidence, through the alias layer. A lookup: no model call. */
export async function skillIdsFromKeywords(keywords: string[]): Promise<Set<string>> {
  return resolveSkillIds(keywords, await getAliasIndex())
}
