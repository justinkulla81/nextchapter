// Priority order for why a given Learning-page item is being shown: (1) a
// named gap from the candidate's own Market Reality Report — the richest,
// most specific signal, already candidate-facing LLM prose elsewhere in
// the app; (2) a direct quote back from their curated "skills to build"
// tag list; (3) a structural fact ("Common for {function} roles",
// "Because you studied at {school}") that's always available so the page
// doesn't go sparse for a thin profile; (4) nothing — the item just isn't
// shown with a generic reason, since a fabricated rationale is worse than
// none.
export interface GapLike {
  area: string
  why: string
}

export function truncate(text: string, max: number): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max).trim()}…` : trimmed
}

export function rationaleForItem(params: {
  matchKey: string
  gaps: GapLike[]
  skillsToBuild: string[]
  structuralFact: string | null
}): string | null {
  const matchingGap = params.gaps.find((g) => g.area.toLowerCase().includes(params.matchKey.toLowerCase()))
  if (matchingGap) return matchingGap.why

  if (params.skillsToBuild.length > 0) {
    return `You said you want to build this: "${truncate(params.skillsToBuild.join(', '), 100)}"`
  }

  if (params.structuralFact) return params.structuralFact

  return null
}
