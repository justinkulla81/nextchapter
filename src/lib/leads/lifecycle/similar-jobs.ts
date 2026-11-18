import 'server-only'
import { prisma } from '@/lib/prisma'
import { similarJobsLike, type LikeJob } from '@/lib/jobs/public-job-page-server'
import { cleanCompanyText } from '@/lib/jobs/public-job-page'
import { searchPublicBoard } from '@/lib/jobs/public-board'

// The three open jobs the application welcome shows: the same occupation as the job they went to apply for, same state first, the
// job page's own "similar jobs" read (shared and cached per occupation, so a send adds one narrow primary-key read of the job).

const JOB_ID = /^[a-z0-9]{10,40}$/i

export async function similarJobsForLead(jobId: string | null | undefined, limit = 3): Promise<LikeJob[]> {
  if (!jobId || !JOB_ID.test(jobId)) return []
  try {
    const job = await prisma.exclusiveJobPosting.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, companyName: true, socCode: true, targetFunction: true, level: true, locationState: true },
    })
    if (!job) return []
    // The same job posted twice under another id is not "another job like it".
    const same = (j: LikeJob) => j.title.trim().toLowerCase() === job.title.trim().toLowerCase() && j.companyName === cleanCompanyText(job.companyName)
    return (await similarJobsLike(job, limit + 2)).filter((j) => !same(j)).slice(0, limit)
  } catch {
    return []
  }
}

export const placeOf = (j: Pick<LikeJob, 'locationCity' | 'locationState'>): string | null =>
  j.locationCity && j.locationState ? `${j.locationCity}, ${j.locationState}` : j.locationState ?? null

export interface LeadJob {
  id: string
  title: string
  company: string
  place: string | null
}

/**
 * The three jobs a job-alert welcome shows: what the saved search finds on the board right now, newest first, only jobs with a page
 * on our site (the same read the daily alert makes, without its "since" date). A failed or slow search gives none.
 */
export async function jobsForSearch(search: { q: string; loc: string; remote: boolean } | null | undefined, limit = 3): Promise<LeadJob[]> {
  if (!search) return []
  try {
    const { jobs } = await searchPublicBoard({ q: search.q, loc: search.loc, remote: search.remote, skipTotal: true })
    return jobs.filter((j) => j.pagePath).slice(0, limit).map((j) => ({ id: j.id, title: j.title, company: j.company, place: j.location?.split(';')[0].trim() || null })) // a job listed in several places: the first
  } catch {
    return []
  }
}

/** similarJobsForLead in the email's shape. */
export async function similarLeadJobs(jobId: string | null | undefined, limit = 3): Promise<LeadJob[]> {
  return (await similarJobsForLead(jobId, limit)).map((j) => ({ id: j.id, title: j.title, company: j.companyName, place: placeOf(j) }))
}
