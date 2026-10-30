import { SITE_URL } from '@/lib/seo/facts'
import { datePostedOf, descriptionHtml, isRemoteJob, payLabel, placeLabel, validThroughOf, type PublicJobRow } from '@/lib/jobs/public-job-page'
import { cdata } from '@/lib/syndication/syndication'

// The crawled-job aggregator feeds (restored from before PR #422): pure XML builders, unit-tested in
// src/test/job-feed-xml.test.ts. The stored-file side is job-feed-server.ts.

export const jobPageUrl = (id: string) => `${SITE_URL}/jobs/${id}`

// ── XML feed (Indeed-style <source><job>…</job></source>) ─────────────────────
// The format Jooble, Talent.com, Adzuna, Careerjet, Jora, WhatJobs and others read.

// Indeed's jobtype words; only exact matches (interim, fractional, … are left out).
const FEED_JOB_TYPE: Record<string, string> = { full_time: 'fulltime', part_time: 'parttime', contract: 'contract', temporary: 'temporary' }

export function feedHead(builtAt: Date): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<source>\n' +
    `<publisher>NextChapter</publisher>\n<publisherurl>${SITE_URL}</publisherurl>\n` +
    `<lastBuildDate>${builtAt.toUTCString()}</lastBuildDate>\n`
  )
}


/** `url` overrides the job's link in the feed (the employer feed sends applicants to the employer's own apply link). */
export function feedJobXml(job: PublicJobRow, url: string = jobPageUrl(job.id)): string {
  const remote = isRemoteJob(job)
  const parts = [
    `<title>${cdata(job.title)}</title>`,
    `<date>${cdata(datePostedOf(job).toUTCString())}</date>`,
    // Talent.com's required name for the posted date (https://www.talent.com/integrations), ISO 8601.
    `<dateposted>${cdata(datePostedOf(job).toISOString())}</dateposted>`,
    `<referencenumber>${cdata(job.id)}</referencenumber>`,
    `<url>${cdata(url)}</url>`,
    `<company>${cdata(job.companyName)}</company>`,
    `<city>${cdata(job.locationCity)}</city>`,
    `<state>${cdata(job.locationState)}</state>`,
    `<country>${cdata('US')}</country>`,
    `<description>${cdata(descriptionHtml(job.description))}</description>`,
  ]
  const expires = validThroughOf(job)
  if (expires) parts.push(`<expirationdate>${cdata(expires.toISOString())}</expirationdate>`)
  parts.push(`<isremote>${cdata(remote ? 'yes' : 'no')}</isremote>`)
  // Yearly pay only: live rows carry yearly-sized figures labelled "day", which is not real pay.
  const pay = job.payPeriod === 'year' ? payLabel(job.salaryMin, job.salaryMax, job.payPeriod) : null
  if (pay) parts.push(`<salary>${cdata(pay)}</salary>`)
  const type = job.employmentType ? FEED_JOB_TYPE[job.employmentType] : undefined
  if (type) parts.push(`<jobtype>${cdata(type)}</jobtype>`)
  if (remote) parts.push(`<remotetype>${cdata('Fully remote')}</remotetype>`)
  else if (job.workArrangement === 'hybrid') parts.push(`<remotetype>${cdata('Hybrid remote')}</remotetype>`)
  return `<job>\n${parts.join('\n')}\n</job>\n`
}

// ── Jooble feed ───────────────────────────────────────────────────────────────
// Jooble's own tag set (https://jooble.org/files/xml_feed_specifications.pdf): <job id="…">
// with <link>, <name>, <region>, <description>, <pubdate> in DD.MM.YYYY and optional
// <salary>, <company>, <expire>, <jobtype>. Jooble only indexes jobs published within 45
// days of first indexing, so the builder skips older ones.

export const JOOBLE_MAX_AGE_DAYS = 45

const ddmmyyyy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
const JOOBLE_JOB_TYPE: Record<string, string> = { full_time: 'full-time', part_time: 'part-time', contract: 'contract', temporary: 'temporary' }

/** True when Jooble would index the job (published within JOOBLE_MAX_AGE_DAYS of `nowMs`). */
export function isFreshForJooble(job: Pick<PublicJobRow, 'postedAt' | 'createdAt'>, nowMs: number): boolean {
  return nowMs - datePostedOf(job).getTime() <= JOOBLE_MAX_AGE_DAYS * 86_400_000
}

export function joobleJobXml(job: PublicJobRow, url: string): string {
  const parts = [
    `<link>${cdata(url)}</link>`,
    `<name>${cdata(job.title)}</name>`,
    `<region>${cdata(placeLabel(job) ?? job.locationState ?? 'United States')}</region>`,
    `<description>${cdata(descriptionHtml(job.description))}</description>`,
    `<pubdate>${cdata(ddmmyyyy(datePostedOf(job)))}</pubdate>`,
    // Jooble's required re-check date: when we last saw the posting live.
    `<updated>${cdata(ddmmyyyy(job.lastVerifiedAt ?? datePostedOf(job)))}</updated>`,
    `<company>${cdata(job.companyName)}</company>`,
  ]
  const expires = validThroughOf(job)
  if (expires) parts.push(`<expire>${cdata(ddmmyyyy(expires))}</expire>`)
  // Yearly pay only: live rows carry yearly-sized figures labelled "day", which is not real pay.
  const pay = job.payPeriod === 'year' ? payLabel(job.salaryMin, job.salaryMax, job.payPeriod) : null
  if (pay) parts.push(`<salary>${cdata(pay)}</salary>`)
  const type = job.employmentType ? JOOBLE_JOB_TYPE[job.employmentType] : undefined
  if (type) parts.push(`<jobtype>${cdata(type)}</jobtype>`)
  return `<job id="${job.id}">\n${parts.join('\n')}\n</job>\n`
}
