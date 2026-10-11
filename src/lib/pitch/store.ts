import { prisma } from '@/lib/prisma'
import { defaultRuleSet } from './defaults'
import type { CustomerType, RuleSet, SlideRule } from './types'

/**
 * The rule set a deck is built from: the saved override merged over the
 * defaults. Merged by slide id, so a slide added to the defaults later still
 * appears for a type that was edited before it existed (switched on, at the end).
 */
export function mergeRuleSet(type: CustomerType, saved: Partial<RuleSet> | null): RuleSet {
  const base = defaultRuleSet(type)
  if (!saved) return base
  const byId = new Map(base.slides.map((s) => [s.id, s]))
  const out: SlideRule[] = []
  for (const s of saved.slides ?? []) {
    const d = byId.get(s.id)
    if (!d) continue
    out.push({ ...d, enabled: s.enabled, title: s.title, kicker: s.kicker, bullets: s.bullets })
    byId.delete(s.id)
  }
  for (const d of byId.values()) out.push(d)
  return {
    ...base,
    buyer: saved.buyer ?? base.buyer, angle: saved.angle ?? base.angle, tone: saved.tone ?? base.tone, ask: saved.ask ?? base.ask,
    offer: { ...base.offer, ...(saved.offer ?? {}) },
    suggestedPeople: saved.suggestedPeople ?? base.suggestedPeople,
    packages: saved.packages && saved.packages.length ? saved.packages : base.packages,
    reviewNotes: saved.reviewNotes ?? base.reviewNotes,
    slides: out,
  }
}

export async function loadRuleSet(type: CustomerType): Promise<{ rules: RuleSet; edited: boolean }> {
  try {
    const row = await prisma.pitchRuleSet.findUnique({ where: { type } })
    return { rules: mergeRuleSet(type, (row?.rules as Partial<RuleSet> | null) ?? null), edited: !!row }
  } catch {
    // Table not applied yet: fall back to defaults so decks still build.
    return { rules: defaultRuleSet(type), edited: false }
  }
}
