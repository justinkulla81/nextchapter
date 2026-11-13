// What goes in a recruiter's weekly Talent digest. Pure: the cron loads rows, this decides what is worth saying.
// Candidate status comes through buildCandidateStatus, so a firm never reads outside the scopes a candidate granted.

import { buildCandidateStatus, type StatusSource } from './status'
import { isStepDue, PIPELINE_STAGE_LABELS, isPipelineStage } from './pipeline-stages'

export const DIGEST_DAYS = 7
export const DIGEST_LIST_MAX = 8

export type DigestRow = {
  connectionId: string
  name: string
  createdAt: Date
  pipelineStage: string
  nextStepAt: Date | null
  scopes: readonly string[]
  source: StatusSource | null
}

export type WeeklyDigest = {
  newCount: number
  newNames: string[]
  due: { connectionId: string; name: string; stage: string; nextStepAt: Date }[]
  changes: { connectionId: string; name: string; label: string; changedAt: Date; landing: string | null }[]
  isEmpty: boolean
}

export function buildWeeklyDigest(rows: DigestRow[], now = new Date()): WeeklyDigest {
  const since = new Date(now.getTime() - DIGEST_DAYS * 86_400_000)
  const fresh = rows.filter((r) => r.createdAt >= since)
  const due = rows
    .filter((r) => isStepDue(r.nextStepAt, r.pipelineStage, now))
    .sort((a, b) => a.nextStepAt!.getTime() - b.nextStepAt!.getTime())
    .map((r) => ({
      connectionId: r.connectionId,
      name: r.name,
      stage: isPipelineStage(r.pipelineStage) ? PIPELINE_STAGE_LABELS[r.pipelineStage] : r.pipelineStage,
      nextStepAt: r.nextStepAt!,
    }))
  const changes = rows.flatMap((r) => {
    const view = buildCandidateStatus(r.scopes, r.source)
    if (!view.status?.changedAt || view.status.changedAt < since) return []
    const landing = view.landing ? `${view.landing.title} at ${view.landing.employer}` : null
    return [{ connectionId: r.connectionId, name: r.name, label: view.status.label, changedAt: view.status.changedAt, landing }]
  })
  return {
    newCount: fresh.length,
    newNames: fresh.slice(0, DIGEST_LIST_MAX).map((r) => r.name),
    due: due.slice(0, DIGEST_LIST_MAX),
    changes: changes.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime()).slice(0, DIGEST_LIST_MAX),
    isEmpty: fresh.length === 0 && due.length === 0 && changes.length === 0,
  }
}
