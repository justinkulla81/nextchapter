import { formatUsdK } from '@/lib/pay/market-pay'

// Apply kit: copy-ready answers to the questions every application form asks,
// built from templates over the member's own profile and Search Strategy. No AI,
// no per-use cost — the same inputs always give the same words, and the member
// edits them in the form. Shared with native one-click apply (native-apply.ts),
// which sends the same summary and work-authorization lines.

export type ApplyKitField = 'why_company' | 'years' | 'pay' | 'start_date' | 'work_auth' | 'relocation' | 'travel'

export const APPLY_KIT_FIELDS: ApplyKitField[] = ['why_company', 'years', 'pay', 'start_date', 'work_auth', 'relocation', 'travel']

export interface ApplyKitAnswer {
  field: ApplyKitField
  /** The question as forms usually phrase it. */
  label: string
  text: string
  /** Where the answer came from, or what to fill in to improve it. */
  hint: string | null
}

export interface ApplyKitProfile {
  firstName: string | null
  primaryFunction: string | null
  targetFunction: string | null
  yearsExperience: number | null
  topStrengths: string[]
  positioningStatementText: string | null
  targetCompMin: number | null
  compFlexible: boolean
  currentJobStatus: string | null
  workAuthorization: string | null
  visaStatus: string | null
  openToRelocation: boolean
  relocationNotes: string | null
  travelWillingness: boolean
  currentCity: string | null
  currentState: string | null
}

export interface ApplyKitJob {
  title: string
  companyName: string
  confidential: boolean
  location: string | null
}

export const WORK_AUTH_ANSWER: Record<string, string> = {
  us_citizen: 'Yes. I am a U.S. citizen and do not need sponsorship.',
  permanent_resident: 'Yes. I am a U.S. permanent resident (green card) and do not need sponsorship.',
  work_authorized_no_sponsorship: 'Yes. I am authorized to work in the U.S. and do not need sponsorship.',
  need_sponsorship: 'I am authorized to work in the U.S. now and will need visa sponsorship.',
}

const VISA_LABEL: Record<string, string> = { h1b: 'H-1B', opt: 'OPT / STEM OPT', tn: 'TN' }

// TOP_STRENGTH_OPTIONS values (constants/onboarding.ts), phrased to follow "known for".
const STRENGTH_LABEL: Record<string, string> = {
  expert_in_field: 'deep expertise in my field',
  fast_learner: 'learning fast',
  clear_communicator: 'clear communication',
  calm_under_pressure: 'staying calm under pressure',
  team_player: 'being a strong team player',
  people_manager: 'managing people well',
  detail_oriented: 'attention to detail',
  work_ethic: 'a strong work ethic',
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function fn(p: ApplyKitProfile): string | null {
  const f = p.primaryFunction ?? p.targetFunction
  return f && f !== 'Other' && f !== 'General' ? f : null
}

/** One or two sentences a member can paste as "tell us about yourself" / summary. */
export function profileSummary(p: ApplyKitProfile): string {
  if (p.positioningStatementText?.trim()) return p.positioningStatementText.trim()
  const parts: string[] = []
  const f = fn(p)
  if (p.yearsExperience && f) parts.push(`${p.yearsExperience} years in ${f.toLowerCase()}`)
  else if (p.yearsExperience) parts.push(`${p.yearsExperience} years of experience`)
  else if (f) parts.push(`Experienced ${f.toLowerCase()} professional`)
  const strengths = p.topStrengths.map((s) => STRENGTH_LABEL[s]).filter(Boolean)
  if (strengths.length) parts.push(`known for ${joinList(strengths)}`)
  return parts.length ? `${parts.join(', ')}.`.replace(/^./, (c) => c.toUpperCase()) : ''
}

export function workAuthAnswer(p: Pick<ApplyKitProfile, 'workAuthorization' | 'visaStatus'>): string | null {
  if (!p.workAuthorization) return null
  if (p.workAuthorization === 'need_sponsorship' && p.visaStatus && VISA_LABEL[p.visaStatus]) {
    return `I am authorized to work in the U.S. now on ${VISA_LABEL[p.visaStatus]} and will need visa sponsorship.`
  }
  return WORK_AUTH_ANSWER[p.workAuthorization] ?? null
}

function startDateAnswer(status: string | null): string {
  switch (status) {
    case 'EMPLOYED_CONSIDERING_MOVE':
    case 'SEEKING_PROMOTION':
      return 'I can start two weeks after accepting an offer, once I give notice to my current employer.'
    case 'NEW_GRADUATE_FIRST_JOB':
      return 'I can start right away, or on a date that works for the team.'
    default:
      return 'I am available to start immediately.'
  }
}

export function buildApplyKit(p: ApplyKitProfile, job: ApplyKitJob): ApplyKitAnswer[] {
  const company = job.confidential ? 'your company' : job.companyName
  const f = fn(p)
  const strengths = p.topStrengths.map((s) => STRENGTH_LABEL[s]).filter(Boolean)
  const answers: ApplyKitAnswer[] = []

  // Why this company — a template the member finishes with one specific detail.
  const why = [
    `I'm applying for the ${job.title} role because it matches what I do best${f ? `: ${p.yearsExperience ? `${p.yearsExperience} years in ${f.toLowerCase()}` : f.toLowerCase()}` : ''}.`,
    strengths.length ? `The people I've worked with know me for ${joinList(strengths)}, which is what this role needs.` : null,
    `What draws me to ${company} specifically is [one thing you admire: a product, a recent announcement, or how they treat customers].`,
  ]
    .filter(Boolean)
    .join(' ')
  answers.push({
    field: 'why_company',
    label: `Why ${job.confidential ? 'this company' : company}?`,
    text: why,
    hint: 'Replace the part in [brackets] with one real detail. That one line is what a reader remembers.',
  })

  answers.push({
    field: 'years',
    label: f ? `Years of experience in ${f.toLowerCase()}` : 'Years of relevant experience',
    text: p.yearsExperience != null ? String(p.yearsExperience) : '',
    hint: p.yearsExperience != null ? 'From your profile.' : 'Add your years of experience on your profile to fill this in.',
  })

  answers.push({
    field: 'pay',
    label: 'Pay expectations',
    text: p.targetCompMin
      ? `I'm targeting ${formatUsdK(p.targetCompMin)} or more in base salary${p.compFlexible ? ', and I am flexible for the right role and total package' : ', depending on the full package'}.`
      : 'I would like to learn more about the role and its full package first. I am confident we can agree on a fair number.',
    hint: p.targetCompMin ? 'From your Search Strategy.' : 'Set a target salary in Search Strategy to fill this in with a number.',
  })

  answers.push({ field: 'start_date', label: 'Start date / notice period', text: startDateAnswer(p.currentJobStatus), hint: 'Based on your current situation.' })

  const auth = workAuthAnswer(p)
  answers.push({
    field: 'work_auth',
    label: 'Are you legally authorized to work in the U.S.? Will you need sponsorship?',
    text: auth ?? '',
    hint: auth ? 'From your profile.' : 'Confirm your work authorization on your profile to fill this in.',
  })

  const home = [p.currentCity, p.currentState].filter(Boolean).join(', ')
  answers.push({
    field: 'relocation',
    label: 'Are you willing to relocate?',
    text: p.openToRelocation
      ? `Yes, I am open to relocating for this role.${p.relocationNotes?.trim() ? ` ${p.relocationNotes.trim()}` : ''}`
      : `I am not planning to relocate${home ? ` from ${home}` : ''}, and I am happy to discuss remote or hybrid options.`,
    hint: 'From your Search Strategy.',
  })

  answers.push({
    field: 'travel',
    label: 'Are you willing to travel?',
    text: p.travelWillingness ? 'Yes, I am comfortable with travel the role requires.' : 'I can travel occasionally; I would like to understand how much travel the role involves.',
    hint: 'From your Search Strategy.',
  })

  return answers
}

export interface ResumeOption {
  id: string
  label: string | null
  fileName: string
  description: string | null
  uploadedAt: Date
}

const STOP = new Set(['and', 'the', 'of', 'for', 'a', 'an', 'to', 'in', 'resume', 'cv', 'pdf', 'docx', 'final', 'version', 'v1', 'v2', 'v3', 'my'])

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOP.has(t))
  )
}

/**
 * Which résumé version to send: the one whose name or note shares the most words
 * with the job title, else the most recent upload.
 */
export function pickResume(resumes: ResumeOption[], jobTitle: string): { resume: ResumeOption; reason: string } | null {
  if (resumes.length === 0) return null
  const sorted = [...resumes].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
  if (sorted.length === 1) return { resume: sorted[0], reason: 'Your only résumé on file.' }
  const want = tokens(jobTitle)
  let best: ResumeOption | null = null
  let bestScore = 0
  for (const r of sorted) {
    const have = tokens(`${r.label ?? ''} ${r.fileName} ${r.description ?? ''}`)
    let score = 0
    for (const t of want) if (have.has(t)) score++
    if (score > bestScore) {
      best = r
      bestScore = score
    }
  }
  if (best) return { resume: best, reason: `Its name or note matches this job's title.` }
  return { resume: sorted[0], reason: 'Your most recent version. None of your versions is named for this kind of role.' }
}

export function resumeName(r: Pick<ResumeOption, 'label' | 'fileName'>): string {
  return r.label?.trim() || r.fileName
}
