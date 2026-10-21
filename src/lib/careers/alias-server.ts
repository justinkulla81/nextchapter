import 'server-only'
import { prisma } from '@/lib/prisma'
import { buildAliasIndex, resolveSkillIds, type AliasIndex } from '@/lib/careers/skill-aliases'

const TTL_MS = 60 * 60 * 1000
let memo: { at: number; value: Promise<AliasIndex> } | null = null

async function load(): Promise<AliasIndex> {
  try {
    return buildAliasIndex(await prisma.skillAlias.findMany({ select: { alias: true, skillId: true } }))
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
