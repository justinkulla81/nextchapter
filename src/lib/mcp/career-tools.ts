import 'server-only'
import { prisma } from '@/lib/prisma'
import { cleanPublicQuery, searchPublicBoardCached } from '@/lib/jobs/public-board'
import { getPublicNotices } from '@/lib/warn/layoff-pages'
import { employerSlug } from '@/lib/warn/layoff-pages'
import { loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { AI_EXPOSURE_SOURCE, BAND_LABEL, bandOf, soc6Of } from '@/lib/skills/ai-exposure'
import { analyzeResume, RESUME_MAX_CHARS, RESUME_MIN_CHARS } from '@/lib/tools/resume-check'
import { SITE_URL } from '@/lib/seo/facts'

// The two tools an assistant cannot do on its own: a job search over our own deduplicated professional board with what
// each job means for the person (AI exposure, level, pay, the employer's layoff record, a direct apply link), and a
// fixed-rule résumé score. Neither calls a model; the assistant does any rewriting with its own tokens.

/** Plain words an assistant can pass for `level`, mapped to ncrawl's seniority values (the same grouping the AI market pages use). */
export const LEVEL_GROUPS: Record<string, string[]> = {
  entry: ['ENTRY_IC'],
  early: ['EARLY_IC'],
  mid: ['MID_IC'],
  senior: ['SENIOR_IC', 'PRINCIPAL'],
  manager: ['MANAGER', 'SR_MANAGER'],
  director: ['DIRECTOR', 'HEAD', 'CHIEF_OF_STAFF'],
  vp: ['VP', 'EVP_SVP', 'C_SUITE'],
}
const LEVEL_NAMES = Object.keys(LEVEL_GROUPS)
const LEVEL_OF: Record<string, string> = Object.fromEntries(Object.entries(LEVEL_GROUPS).flatMap(([name, raws]) => raws.map((r) => [r, name])))

export const CAREER_TOOLS = [
  {
    name: 'search_jobs',
    title: 'Search professional jobs',
    description:
      'Call this when someone wants job openings, for example "jobs for a senior finance manager in Denver", "remote director roles" or "who is hiring after my layoff". Searches NextChapter’s own deduplicated board of current professional openings at U.S. employers, newest first; hourly, per-diem and internship roles are excluded. Needs no login. Each job returns the title, company, location, posted date, annual pay when listed, level, how much of that occupation’s work AI is already used for, whether the employer has filed layoff notices in the last 12 months, our page for the job and the employer’s own apply link.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to match in the job title or company, e.g. "director of finance".' },
        location: { type: 'string', description: 'City or state to match, e.g. "Denver" or "TX".' },
        remote: { type: 'boolean', description: 'Only remote roles.' },
        level: { type: 'string', enum: LEVEL_NAMES, description: 'Seniority: entry, early, mid, senior, manager, director or vp (vp includes executives).' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'score_resume',
    title: 'Score a résumé',
    description:
      'Call this when someone shares or asks about their résumé, for example "check my résumé", "will this get past applicant tracking systems" or "what is wrong with my résumé". Pass the résumé as plain text. Scores it out of 100 with fixed rules, the same text always gets the same score, and returns a pass, partial or fail for each of eleven checks with what was seen and the exact fix. It checks structure and wording (contact details, length, headings, results with numbers, weak phrases, summary, dates, layout). It cannot judge whether experience suits a role. Use the findings to rewrite the résumé; the text is scored once and not stored.',
    inputSchema: {
      type: 'object',
      properties: { resume_text: { type: 'string', description: `The résumé as plain text, ${RESUME_MIN_CHARS} to ${RESUME_MAX_CHARS.toLocaleString('en-US')} characters.` } },
      required: ['resume_text'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const

export const CAREER_TOOL_NAMES: readonly string[] = CAREER_TOOLS.map((t) => t.name)

const DAY_MS = 86_400_000

/** Annual pay in USD from a posted range and its period, or null when the period is unknown or not annualizable. */
export function annualPay(min: number | null, max: number | null, period: string | null): { min: number | null; max: number | null } | null {
  const mult = ({ year: 1, month: 12, week: 52, day: 260 } as Record<string, number>)[period ?? 'year']
  if (!mult || (!min && !max)) return null
  return { min: min ? Math.round(min * mult) : null, max: max ? Math.round(max * mult) : null }
}

const NOT_PROFESSIONAL = new Set(['per_diem', 'internship', 'co_op', 'coop'])

export async function searchJobsTool(args: Record<string, unknown>) {
  const level = typeof args.level === 'string' && LEVEL_GROUPS[args.level] ? args.level : null
  const query = {
    ...cleanPublicQuery({
      q: typeof args.query === 'string' ? args.query : '',
      loc: typeof args.location === 'string' ? args.location : '',
      remote: args.remote === true ? '1' : '',
    }),
    ...(level ? { levels: LEVEL_GROUPS[level] } : {}),
  }
  const result = await searchPublicBoardCached(query)
  const ids = result.jobs.map((j) => j.id)
  const [details, exposure, notices] = ids.length
    ? await Promise.all([
        prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids } }, select: { id: true, socCode: true, level: true, payPeriod: true, employmentType: true, workArrangement: true } }),
        loadExposureMap(),
        getPublicNotices(),
      ])
    : [[], new Map() as Awaited<ReturnType<typeof loadExposureMap>>, []]
  const byId = new Map(details.map((d) => [d.id, d]))
  const now = Date.now()
  const recent = new Map<string, { count: number; workers: number; latest: number }>()
  for (const n of notices) {
    if (now - n.noticeDate.getTime() > 365 * DAY_MS) continue
    const r = recent.get(n.slug) ?? { count: 0, workers: 0, latest: 0 }
    r.count++
    r.workers += n.workers ?? 0
    r.latest = Math.max(r.latest, n.noticeDate.getTime())
    recent.set(n.slug, r)
  }

  const jobs = result.jobs
    .filter((j) => {
      const d = byId.get(j.id)
      return !d || (d.payPeriod !== 'hour' && !NOT_PROFESSIONAL.has(d.employmentType ?? ''))
    })
    .map((j) => {
      const d = byId.get(j.id)
      const soc6 = d?.socCode ? soc6Of(d.socCode) : null
      const hit = soc6 ? exposure.get(soc6) : undefined
      const slug = employerSlug(j.company, null)
      const lay = slug ? recent.get(slug) : undefined
      const pay = d ? annualPay(j.salaryMin, j.salaryMax, d.payPeriod) : annualPay(j.salaryMin, j.salaryMax, 'year')
      return {
        title: j.title,
        company: j.company,
        location: j.location,
        posted: j.postedAt,
        level: d?.level ? (LEVEL_OF[d.level] ?? null) : null,
        workArrangement: d?.workArrangement ?? null,
        annualPayUsd: pay,
        aiExposure: hit ? { occupation: hit.title, share: Math.round(hit.score * 100) / 100, band: BAND_LABEL[bandOf(hit.score)] } : null,
        employerLayoffNotices: lay
          ? { last12Months: lay.count, workersNamed: lay.workers, latestFiled: new Date(lay.latest).toISOString().slice(0, 10), page: `${SITE_URL}/layoffs/company/${slug}` }
          : null,
        url: j.pagePath ? `${SITE_URL}${j.pagePath}` : j.url,
        applyUrl: j.url,
      }
    })
  return {
    total_matches: result.total,
    shown: jobs.length,
    jobs,
    browse_more: `${SITE_URL}/jobs`,
    asOf: new Date().toISOString().slice(0, 10),
    source: { name: 'NextChapter job board', url: `${SITE_URL}/jobs`, exposure: AI_EXPOSURE_SOURCE.name },
  }
}

export function scoreResumeTool(args: Record<string, unknown>) {
  const text = typeof args.resume_text === 'string' ? args.resume_text : ''
  const r = analyzeResume(text)
  if (!r) {
    return { error: `Send the résumé as plain text between ${RESUME_MIN_CHARS} and ${RESUME_MAX_CHARS.toLocaleString('en-US')} characters (it was ${text.trim().length.toLocaleString('en-US')}).` }
  }
  return {
    score: r.score,
    outOf: 100,
    band: r.bandLabel,
    wordCount: r.wordCount,
    checksNeedingWork: r.issueCount,
    findings: r.findings.map((f) => ({ check: f.label, status: f.status, pointsEarned: f.earned, pointsPossible: f.points, whatWeSaw: f.detail, fix: f.fix })),
    method: 'Fixed rules, no AI. The same text always gets the same score. It checks structure and wording, not whether the experience suits a role.',
    page: `${SITE_URL}/tools/resume-check`,
    source: 'NextChapter résumé check',
  }
}

export async function callCareerTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'search_jobs') return searchJobsTool(args)
  if (name === 'score_resume') return scoreResumeTool(args)
  return null
}
