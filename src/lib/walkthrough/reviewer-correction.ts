// "That's wrong" write-back for the guided walkthrough's reviewer-question
// and thin-entry steps (§13.1) — most ReviewerQuestion.detectionType values
// trace back to WorkHistoryEntry dates/title/scope fields (checked
// detectedContext's shape per type in
// src/lib/scoring/resume-analysis/reviewer-questions.ts before writing
// this); CREDENTIAL_NO_INSTITUTION traces to EducationEntry.schoolName
// instead. PORTFOLIO_CAREER and COMP_FIT_RISK don't reduce to a single
// correctable field, so those always fall through to 'unmatched' and the
// UI degrades honestly (see ReviewerQuestionStep's fallback copy) rather
// than pretending to offer a fix that isn't real.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { EducationEntry, WorkHistoryEntry } from '@prisma/client'
import type { ReviewerDetectionType } from '@/lib/scoring/resume-analysis/types'

export type ReviewerCorrectionTarget =
  | { kind: 'work_history'; entries: WorkHistoryEntry[] }
  | { kind: 'education'; entries: EducationEntry[] }
  | { kind: 'unmatched' }

// Which detectedContext keys hold a role title to match WorkHistoryEntry
// against, per detection type (see reviewer-questions.ts for exact shapes).
const TITLE_HINT_KEYS: Partial<Record<ReviewerDetectionType, string[]>> = {
  UNEXPLAINED_RECENT_GAP: ['before', 'after'],
  UNEXPLAINED_CURRENT_GAP: ['lastRole'],
  SHORT_TENURE_RECENT: ['role'],
  SCOPE_DECREASE: ['from', 'to'],
  THIN_RECENT_ENTRY: ['role'],
  EXTENDED_TENURE_NO_CHANGE: ['role'],
  TITLE_INFLATION: ['role'],
  OVERLAPPING_ROLES: ['a', 'b'],
  COMP_FIT_RISK: ['role'],
}

function extractHints(detectionType: ReviewerDetectionType, context: Record<string, unknown>): string[] {
  const hints: string[] = []
  for (const key of TITLE_HINT_KEYS[detectionType] ?? []) {
    const value = context[key]
    if (typeof value === 'string' && value.trim()) hints.push(value.trim())
  }
  if (detectionType === 'SHORT_TENURE_CLUSTER' && Array.isArray(context.roles)) {
    for (const role of context.roles) {
      if (typeof role === 'string' && role.trim()) hints.push(role.trim())
    }
  }
  return hints
}

export async function findReviewerCorrectionTarget(
  candidateId: string,
  detectionType: ReviewerDetectionType,
  detectedContext: Record<string, unknown>
): Promise<ReviewerCorrectionTarget> {
  if (detectionType === 'CREDENTIAL_NO_INSTITUTION') {
    const degree = typeof detectedContext.degree === 'string' ? detectedContext.degree : null
    const educationHistory = await prisma.educationEntry.findMany({ where: { candidateId } })
    const match = degree
      ? educationHistory.find((e) => e.degree && e.degree.toLowerCase() === degree.toLowerCase())
      : null
    if (match) return { kind: 'education', entries: [match] }
    // Only one entry to begin with — safe to assume it's the one, even
    // without a degree string to match on.
    if (educationHistory.length === 1) return { kind: 'education', entries: educationHistory }
    return { kind: 'unmatched' }
  }

  if (detectionType === 'PORTFOLIO_CAREER') return { kind: 'unmatched' }

  const hints = extractHints(detectionType, detectedContext)
  if (hints.length === 0) return { kind: 'unmatched' }

  const workHistory = await prisma.workHistoryEntry.findMany({
    where: { candidateId },
    orderBy: { startDate: 'desc' },
  })

  const matched: WorkHistoryEntry[] = []
  for (const hint of hints) {
    const lowerHint = hint.toLowerCase()
    const candidate =
      workHistory.find((w) => w.roleTitle.toLowerCase() === lowerHint && !matched.some((m) => m.id === w.id)) ??
      workHistory.find(
        (w) =>
          (w.roleTitle.toLowerCase().includes(lowerHint) || lowerHint.includes(w.roleTitle.toLowerCase())) &&
          !matched.some((m) => m.id === w.id)
      )
    if (candidate) matched.push(candidate)
  }

  return matched.length > 0 ? { kind: 'work_history', entries: matched } : { kind: 'unmatched' }
}
