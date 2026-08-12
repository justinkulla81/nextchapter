import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'
import { inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'

export type RejectionLevelFlag = 'stretch' | 'step_down' | null

export type RejectionBackchannelStatus =
  | 'reached_out' // had a contact at the company and logged outreach to them
  | 'had_contact_no_record' // has a contact there but no outreach on file — the "work the system more" case
  | 'no_contact' // no contact on file at that company

export interface RejectionInsight {
  id: string
  title: string | null
  companyName: string | null
  appliedAt: Date | null
  declinedAt: Date
  daysToRejection: number | null
  levelFlag: RejectionLevelFlag
  backchannelStatus: RejectionBackchannelStatus
  contactNames: string[]
}

// Read-only, computed entirely from data already on file — no LLM call.
// Feeds the Rejection List section on Find a Full-time Job. "Stretch" /
// "step down" mirrors the same calibratedLevelRank math job-fit-bucket.ts
// uses for Discover badges, just without the rest of that pipeline (no
// score, no company-size band — these are self-logged JobPosting rows, not
// structured listings). backchannelStatus only reflects what's on file in
// this app (SupportNetworkContact company match + logged OutreachLog) — it
// can't see outreach that happened outside NextChapter.
export async function getRejectionInsights(
  candidateId: string,
  highestLevelReached: string | null,
  levelRankScore: number | null
): Promise<RejectionInsight[]> {
  const [rejectedJobs, contacts] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { candidateId, declinedAt: { not: null } },
      orderBy: { declinedAt: 'desc' },
      select: {
        id: true,
        title: true,
        companyName: true,
        appliedAt: true,
        declinedAt: true,
        helpfulContacts: { select: { id: true, name: true } },
      },
    }),
    prisma.supportNetworkContact.findMany({
      where: { candidateId, removedAt: null },
      select: {
        id: true,
        name: true,
        company: true,
        inferredCompany: true,
        outreachLogs: { select: { id: true }, take: 1 },
      },
    }),
  ])

  const candidateScore = levelRankScore ?? calibratedLevelRank(highestLevelReached, null)

  return rejectedJobs.map((job) => {
    const daysToRejection =
      job.appliedAt && job.declinedAt
        ? Math.round((job.declinedAt.getTime() - job.appliedAt.getTime()) / (24 * 60 * 60 * 1000))
        : null

    let levelFlag: RejectionLevelFlag = null
    if (candidateScore !== null && job.title) {
      const roleScore = calibratedLevelRank(inferLevelFromTitle(job.title), null)
      if (roleScore !== null && roleScore !== candidateScore) {
        levelFlag = roleScore > candidateScore ? 'stretch' : 'step_down'
      }
    }

    const companyMatches = job.companyName
      ? contacts.filter(
          (c) =>
            (c.company && orgNamesMatch(c.company, job.companyName!)) ||
            (c.inferredCompany && orgNamesMatch(c.inferredCompany, job.companyName!))
        )
      : []
    // helpfulContacts (explicitly flagged on this job) always counts even if
    // the company-name match above missed them (e.g. blank company field).
    const matchedContacts = [
      ...companyMatches,
      ...job.helpfulContacts.filter((h) => !companyMatches.some((c) => c.id === h.id)),
    ]

    let backchannelStatus: RejectionBackchannelStatus = 'no_contact'
    if (matchedContacts.length > 0) {
      const reachedOut = companyMatches.some((c) => c.outreachLogs.length > 0)
      backchannelStatus = reachedOut ? 'reached_out' : 'had_contact_no_record'
    }

    return {
      id: job.id,
      title: job.title,
      companyName: job.companyName,
      appliedAt: job.appliedAt,
      declinedAt: job.declinedAt!,
      daysToRejection,
      levelFlag,
      backchannelStatus,
      contactNames: matchedContacts.map((c) => c.name),
    }
  })
}
