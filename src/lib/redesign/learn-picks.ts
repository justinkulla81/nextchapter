// Learn in the redesign (docs/candidate-redesign.md): one course up front, a few more behind it. Pure, so it is
// tested without the database. Gap-driven courses (the ones that carry a reason) come before general ones.

import type { RetrainingNeed } from '@/lib/skills/ai-exposure'

export interface LearnCandidate {
  title: string
  rationale: string | null
  alreadyHeld: boolean
}

export interface LearnPicks<T extends LearnCandidate> {
  featured: T | null
  more: T[]
}

export function pickLearnCourses<T extends LearnCandidate>(
  items: T[],
  completedTitles: Set<string>,
  enrolledTitles: Set<string>,
  moreCount = 3,
  // When the member's occupation shows high observed AI use (need build_now), an AI-tagged course is featured first
  // if one is open to them. Any other need leaves the order as it was.
  exposure?: { need: RetrainingNeed; isAiCourse: (item: T) => boolean },
): LearnPicks<T> {
  const seen = new Set<string>()
  const open = items.filter((i) => {
    if (i.alreadyHeld || completedTitles.has(i.title) || seen.has(i.title)) return false
    seen.add(i.title)
    return true
  })
  // Courses already started come first within each group: finishing beats starting.
  const aiFirst = exposure?.need === 'build_now'
  const rank = (i: T) => (i.rationale ? 0 : 2) + (enrolledTitles.has(i.title) ? 0 : 1) + (aiFirst && exposure!.isAiCourse(i) ? -10 : 0)
  const sorted = open.map((item, index) => ({ item, index })).sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index).map((x) => x.item)
  return { featured: sorted[0] ?? null, more: sorted.slice(1, 1 + moreCount) }
}
