import { screenImportedJob } from '@/lib/jobs/import-screen'
import { fetchText, type KeptJob } from '@/lib/jobs/gov-feed-core'
import { statesFromLocation } from '@/lib/pay/market-pay'

// Federal jobs for the job board from USAJOBS's Historic JOA API (data.usajobs.gov/api/historicjoa), which needs no key.
// It carries each announcement's metadata but no job summary, so the description below is built from its fields only.
// No database access here.

export const HISTORIC_URL = 'https://data.usajobs.gov/api/historicjoa'

export interface HistoricJoa {
  usajobsControlNumber?: number
  hiringAgencyName?: string
  hiringDepartmentName?: string
  positionTitle?: string
  positionOpenDate?: string
  positionCloseDate?: string | null
  positionOpeningStatus?: string
  announcementNumber?: string
  appointmentType?: string
  workSchedule?: string
  payScale?: string
  minimumGrade?: string
  maximumGrade?: string
  salaryType?: string
  minimumSalary?: number
  maximumSalary?: number
  teleworkEligible?: string
  travelRequirement?: string
  securityClearanceRequired?: string
  securityClearance?: string
  supervisoryStatus?: string
  serviceType?: string
  totalOpenings?: string
  hiringpaths?: { hiringPath?: string }[]
  jobcategories?: { series?: string }[]
  positionlocations?: { positionLocationCity?: string; positionLocationState?: string; positionLocationCountry?: string }[]
}

const GRADE_PLANS = new Set(['GS', 'GG', 'GM', 'GL', 'GP', 'SL', 'ST', 'NH', 'NK', 'NJ', 'NG', 'FV', 'YA', 'YC', 'AD', 'ES', 'SV'])

export function gradedTitle(j: HistoricJoa): string {
  const title = (j.positionTitle ?? '').trim()
  const plan = j.payScale ?? ''
  const grade = j.maximumGrade ?? ''
  if (!title || !GRADE_PLANS.has(plan) || !grade || /\b(GS|GG|GM|SES|SL|ST)\b|\d{2}\s*$/i.test(title)) return title
  return `${title} (${plan}-${grade})`
}

function describe(j: HistoricJoa): string {
  const lines: string[] = []
  const org = [j.hiringAgencyName, j.hiringDepartmentName].filter((x, i, a) => x && a.indexOf(x) === i).join(', ')
  if (org) lines.push(`Federal position with ${org}.`)
  if (j.announcementNumber) lines.push(`Announcement number: ${j.announcementNumber}.`)
  if (j.payScale && j.minimumGrade) lines.push(`Pay plan and grade: ${j.payScale}-${j.minimumGrade}${j.maximumGrade && j.maximumGrade !== j.minimumGrade ? ` to ${j.payScale}-${j.maximumGrade}` : ''}.`)
  const series = j.jobcategories?.map((c) => c.series).filter(Boolean).join(', ')
  if (series) lines.push(`Occupational series: ${series}.`)
  if (j.appointmentType || j.workSchedule) lines.push(`${[j.appointmentType, j.workSchedule].filter(Boolean).join(', ')}.`)
  if (j.supervisoryStatus === 'Y') lines.push('Supervisory position.')
  if (j.teleworkEligible === 'Y') lines.push('Telework eligible.')
  if (j.travelRequirement) lines.push(`Travel: ${j.travelRequirement}.`)
  if (j.securityClearanceRequired === 'Y') lines.push(`Security clearance: ${j.securityClearance ?? 'required'}.`)
  if (j.totalOpenings) lines.push(`Openings: ${j.totalOpenings}.`)
  if (j.positionCloseDate) lines.push(`Closes ${j.positionCloseDate}.`)
  lines.push('Full announcement and how to apply: see the USAJOBS listing.')
  return lines.join('\n')
}

/** The board row inputs for an open-to-the-public federal announcement, or why it is skipped. */
export function joaToKept(j: HistoricJoa, now: Date): { keep: true; kept: KeptJob; closesAt: Date | null } | { keep: false; reason: string } {
  if (!j.usajobsControlNumber || !j.positionTitle) return { keep: false, reason: 'incomplete' }
  if (!j.hiringpaths?.some((h) => h.hiringPath === 'The public')) return { keep: false, reason: 'not open to the public' }
  if (j.positionOpeningStatus && !/accepting/i.test(j.positionOpeningStatus)) return { keep: false, reason: 'not accepting applications' }
  const closes = j.positionCloseDate ? new Date(j.positionCloseDate + 'T23:59:59Z') : null
  if (closes && closes.getTime() < now.getTime()) return { keep: false, reason: 'closed' }
  const loc = j.positionlocations?.find((l) => !l.positionLocationCountry || /united states/i.test(l.positionLocationCountry)) ?? j.positionlocations?.[0]
  const location = loc ? [loc.positionLocationCity, loc.positionLocationState].filter(Boolean).join(', ') || null : null
  const title = gradedTitle(j)
  const employer = [j.hiringAgencyName, j.hiringDepartmentName].filter((x, i, a) => x && a.indexOf(x) === i).join(', ') || 'U.S. federal government'
  const description = describe(j)
  const verdict = screenImportedJob(title, location, { companyName: employer, description })
  if (!verdict.keep) return { keep: false, reason: verdict.reason }
  const yearly = j.salaryType === 'Per Year' && Number(j.minimumSalary) > 0
  const opened = j.positionOpenDate ? new Date(j.positionOpenDate) : null
  return {
    keep: true,
    closesAt: closes,
    kept: {
      url: `https://www.usajobs.gov/job/${j.usajobsControlNumber}`,
      level: verdict.level,
      location: verdict.location,
      posting: {
        title, employer, location: verdict.location, state: statesFromLocation(location).states[0] ?? null, description,
        postedAt: opened && !Number.isNaN(opened.getTime()) ? opened : null,
        employmentType: /full/i.test(j.workSchedule ?? '') ? 'full_time' : /part/i.test(j.workSchedule ?? '') ? 'part_time' : null,
        salaryMin: yearly ? Math.round(Number(j.minimumSalary)) : null,
        salaryMax: yearly ? Math.round(Number(j.maximumSalary ?? j.minimumSalary)) : null,
      },
    },
  }
}

/** Announcements opened in the last `days` days, paged 500 at a time, until `deadline` (ms since epoch). */
export async function fetchRecentJoas(days: number, deadline: number): Promise<{ joas: HistoricJoa[]; complete: boolean }> {
  const today = new Date()
  const start = new Date(today.getTime() - days * 86_400_000)
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  let url: string | null = `${HISTORIC_URL}?StartPositionOpenDate=${ymd(start)}&EndPositionOpenDate=${ymd(today)}`
  const joas: HistoricJoa[] = []
  while (url) {
    if (Date.now() > deadline) return { joas, complete: false }
    let body: string | null = null
    for (let attempt = 0; attempt < 3 && !body; attempt++) body = await fetchText(url, 30_000)
    if (!body) return { joas, complete: false }
    const d = JSON.parse(body) as { paging?: { next?: string | null }; data?: HistoricJoa[] }
    joas.push(...(d.data ?? []))
    url = d.paging?.next ? `https://data.usajobs.gov${d.paging.next}` : null
  }
  return { joas, complete: true }
}
