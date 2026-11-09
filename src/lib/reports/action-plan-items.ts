// The Market Reality Report's 7-day plan: what the code owns and what the model writes.
//
// The model used to be asked to apply about nine "if X is missing, add item Y" rules from the member's data (LinkedIn, Gmail, Search Strategy,
// résumé, profile, industry, function, salary, work authorization) and to put them in a fixed order. It missed them: on 2026-11-07 a member with a
// vague target role got no Search Strategy step from either of two models, one of them tagged an unrelated item with that step's tag, and one
// model wrote networking items the report's own rule forbids (the prompt said both "no networking items" and, in its ordering rule, "networking
// comes later"). These are rules about the data, not judgment, so the code applies them: the setup steps are built here from the member's facts,
// in the right order, and whatever the model wrote is cleaned and placed after them. The model writes the part that needs judgment: specific
// résumé changes, work on the member's open gaps, interview and negotiation steps.
//
// Pure (no database, no model), so every rule is tested.

// Type aliases, not interfaces: the plan is stored as JSON, and only an alias is assignable to Prisma's JSON input type.
export type PlanItem = { text: string; actionType?: string }
export type PlanDay = { day: number; items: PlanItem[] }

/** What the member has and has not done, read from their profile. */
export interface PlanFacts {
  hasResume: boolean
  linkedInConfirmed: boolean
  linkedInUrlOnFile: boolean
  gmailConnected: boolean
  /** A target role that is an actual title, not "flexible" or unset. */
  targetRoleClear: boolean
  profileConfirmed: boolean
  industryConfirmed: boolean
  functionConfirmed: boolean
  /** Both the last salary and the work authorization answered. */
  salaryAndAuthorizationConfirmed: boolean
}

/** Types the code owns: the model must not write these. */
const SETUP_TYPES = new Set(['LINKEDIN_SETUP', 'GMAIL_CONNECTED', 'SEARCH_STRATEGY_CHECKLIST', 'PROFILE_CONFIRM', 'INDUSTRY_CONFIRM', 'FUNCTION_CONFIRM', 'SALARY_CONFIRM', 'WORK_AUTHORIZATION'])
/** Networking, outreach and posting belong to the Dossier, not this report (the report's own scope rule). */
const OUT_OF_SCOPE_TYPES = new Set(['NETWORKING_LIST', 'OUTREACH_MESSAGE', 'LINKEDIN_POST_IDEA'])
const OUT_OF_SCOPE_TEXT = /\b(search sprint|build (out )?your network|networking list|25-person|outreach message)\b/i

/** What an item's text must be about to carry a tag: a tag on an unrelated item would send the member to the wrong place. */
const TAG_TEXT: Record<string, RegExp> = {
  LINKEDIN_SETUP: /linkedin/i,
  GMAIL_CONNECTED: /gmail|e-?mail/i,
  SEARCH_STRATEGY_CHECKLIST: /search strategy|target|deal-?breaker|known for/i,
  PROFILE_CONFIRM: /profile|contact|address|\bname\b/i,
  INDUSTRY_CONFIRM: /industry/i,
  FUNCTION_CONFIRM: /function|title|years/i,
  SALARY_CONFIRM: /salary|pay\b|compensation/i,
  WORK_AUTHORIZATION: /authori[sz]ation|visa|work status|right to work/i,
  INTERVIEW_PREP: /interview/i,
  NEGOTIATION_ADVICE: /negotiat|offer/i,
}

interface Requirement {
  type: string
  /** The step the code writes when the model did not. Shape: a short action name, a dash, why it matters. */
  item: PlanItem
  /** Whether an item the model wrote already does this job. */
  satisfiedBy: (i: PlanItem) => boolean
}

const byTag = (type: string) => (i: PlanItem) => i.actionType === type

/** The setup steps this member needs, in the order they belong: LinkedIn, Gmail, Search Strategy, résumé, then the confirmations. */
export function requirementsFor(f: PlanFacts): Requirement[] {
  const r: Requirement[] = []
  if (!f.linkedInConfirmed) {
    r.push({ type: 'LINKEDIN_SETUP', item: { text: 'Confirm your LinkedIn status — recruiters source here before anywhere else.', actionType: 'LINKEDIN_SETUP' }, satisfiedBy: byTag('LINKEDIN_SETUP') })
  } else if (!f.linkedInUrlOnFile) {
    r.push({ type: 'LINKEDIN_SETUP', item: { text: 'Create your LinkedIn profile — recruiters look there first, and it puts you in front of people you have not met.', actionType: 'LINKEDIN_SETUP' }, satisfiedBy: byTag('LINKEDIN_SETUP') })
  }
  if (!f.gmailConnected) {
    r.push({ type: 'GMAIL_CONNECTED', item: { text: 'Connect your Gmail — interview invites and rejections get tracked for you instead of by hand.', actionType: 'GMAIL_CONNECTED' }, satisfiedBy: byTag('GMAIL_CONNECTED') })
  }
  if (!f.targetRoleClear) {
    r.push({
      type: 'SEARCH_STRATEGY_CHECKLIST',
      item: { text: 'Fill in your Search Strategy — your target, what you are known for and your deal-breakers are the first filter every match runs on.', actionType: 'SEARCH_STRATEGY_CHECKLIST' },
      satisfiedBy: byTag('SEARCH_STRATEGY_CHECKLIST'),
    })
  }
  if (!f.hasResume) {
    r.push({
      type: 'RESUME_UPDATE',
      item: { text: 'Upload your resume — it lets us give you specific, evidence-based fixes and a truer read of your market.', actionType: 'RESUME_UPDATE' },
      satisfiedBy: (i) => i.actionType === 'RESUME_UPDATE' && /upload/i.test(i.text),
    })
  } else {
    // Any specific résumé change the model wrote counts: the rule is "apply the fixes", and a named fix is better than a generic one.
    r.push({
      type: 'RESUME_UPDATE',
      item: { text: 'Apply your resume fixes — they are the quickest way to change how your resume reads.', actionType: 'RESUME_UPDATE' },
      satisfiedBy: byTag('RESUME_UPDATE'),
    })
  }
  if (!f.profileConfirmed) {
    r.push({ type: 'PROFILE_CONFIRM', item: { text: 'Confirm your profile details — they were filled in from your resume and may need correcting.', actionType: 'PROFILE_CONFIRM' }, satisfiedBy: byTag('PROFILE_CONFIRM') })
  }
  if (!f.industryConfirmed) {
    r.push({ type: 'INDUSTRY_CONFIRM', item: { text: 'Confirm your industry — it is the first filter every match runs on.', actionType: 'INDUSTRY_CONFIRM' }, satisfiedBy: byTag('INDUSTRY_CONFIRM') })
  }
  if (!f.functionConfirmed) {
    r.push({ type: 'FUNCTION_CONFIRM', item: { text: 'Confirm function, title and years — they were filled in from your resume and drive every match.', actionType: 'FUNCTION_CONFIRM' }, satisfiedBy: byTag('FUNCTION_CONFIRM') })
  }
  if (!f.salaryAndAuthorizationConfirmed) {
    r.push({ type: 'SALARY_CONFIRM', item: { text: 'Enter your last salary — it is not on your resume and it shapes your target range.', actionType: 'SALARY_CONFIRM' }, satisfiedBy: byTag('SALARY_CONFIRM') })
    r.push({ type: 'WORK_AUTHORIZATION', item: { text: 'Answer work authorization — employers screen on this before reading anything else.', actionType: 'WORK_AUTHORIZATION' }, satisfiedBy: byTag('WORK_AUTHORIZATION') })
  }
  return r
}

/** The steps the code writes for a member with these facts (the model's own versions, when it wrote them, are used instead). */
export function requiredPlanItems(f: PlanFacts): PlanItem[] {
  return requirementsFor(f).map((r) => r.item)
}

export interface PlanStats {
  /** Setup steps this member needs. */
  required: number
  /** Of those, how many the model wrote itself (a measure of whether the prompt still needs to ask). */
  writtenByModel: number
  /** Setup steps the code had to add. */
  added: number
  /** Items dropped for networking, outreach, posting or Search Sprint framing. */
  droppedOutOfScope: number
  /** Items dropped because they repeated a setup step that was not needed. */
  droppedRedundant: number
  /** Items whose tag did not match their text, kept without the tag. */
  untagged: number
  /** The model's own items cut by the cap. */
  cut: number
  total: number
}

/** At most this many items in the plan: about two a day. The setup steps always stay; the model's last items go first. */
export const MAX_PLAN_ITEMS = 14

function sameText(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return n(a) === n(b)
}

/** Spreads the items over up to seven days in order, as evenly as possible (earlier days take the extra item). */
export function packIntoDays(items: PlanItem[]): PlanDay[] {
  const n = items.length
  if (n === 0) return []
  const days = Math.min(7, n)
  const base = Math.floor(n / days)
  const extra = n % days
  const out: PlanDay[] = []
  let at = 0
  for (let d = 0; d < days; d++) {
    const size = base + (d < extra ? 1 : 0)
    out.push({ day: d + 1, items: items.slice(at, at + size) })
    at += size
  }
  return out
}

/**
 * The plan the member sees: the model's items cleaned of anything out of scope or mis-tagged, with the setup steps this member needs in front
 * of them, in order. A setup step the model wrote itself is used (and moved into its place); one it missed is written here.
 */
export function finalizeActionPlan(modelPlan: PlanDay[], facts: PlanFacts): { days: PlanDay[]; stats: PlanStats } {
  const requirements = requirementsFor(facts)
  const needed = new Set(requirements.map((r) => r.type))
  const stats: PlanStats = { required: requirements.length, writtenByModel: 0, added: 0, droppedOutOfScope: 0, droppedRedundant: 0, untagged: 0, cut: 0, total: 0 }

  const own: PlanItem[] = []
  for (const raw of modelPlan.flatMap((d) => d.items)) {
    const text = (raw.text ?? '').trim()
    if (!text) continue
    if ((raw.actionType && OUT_OF_SCOPE_TYPES.has(raw.actionType)) || OUT_OF_SCOPE_TEXT.test(text)) {
      stats.droppedOutOfScope++
      continue
    }
    let item: PlanItem = raw.actionType ? { text, actionType: raw.actionType } : { text }
    const tagRule = item.actionType ? TAG_TEXT[item.actionType] : undefined
    if (item.actionType && tagRule && !tagRule.test(text)) {
      // A tag on an item that is about something else would link the member to the wrong place.
      item = { text }
      stats.untagged++
    } else if (item.actionType && SETUP_TYPES.has(item.actionType) && !needed.has(item.actionType)) {
      // A setup step this member has already done.
      stats.droppedRedundant++
      continue
    }
    if (own.some((o) => sameText(o.text, item.text))) continue
    own.push(item)
  }

  const used = new Set<number>()
  const setup: PlanItem[] = []
  for (const r of requirements) {
    const at = own.findIndex((i, n) => !used.has(n) && r.satisfiedBy(i))
    if (at >= 0) {
      used.add(at)
      setup.push(own[at])
      stats.writtenByModel++
    } else {
      setup.push(r.item)
      stats.added++
    }
  }
  const rest = own.filter((_, n) => !used.has(n))
  const room = Math.max(0, MAX_PLAN_ITEMS - setup.length)
  stats.cut = Math.max(0, rest.length - room)
  const items = [...setup, ...rest.slice(0, room)]
  stats.total = items.length
  return { days: packIntoDays(items), stats }
}

/**
 * The action-plan part of the model's instructions. Kept beside the code that finishes the plan so the two cannot disagree: whatever the
 * code owns is listed here as "not yours to write".
 */
export const ACTION_PLAN_PROMPT_SECTION = `3. An action plan: 7 to 9 concrete items, most important first, each with a "text" field and an optional "actionType" tag. The setup steps are NOT yours to write: NextChapter adds them itself, in the right order, from the data below. They are confirming LinkedIn or creating a profile, connecting Gmail, filling in the Search Strategy page when the target role is vague, uploading a resume or applying the resume fixes, and confirming profile details, industry, function/title/years, last salary and work authorization. Never write those steps, and never use the actionTypes LINKEDIN_SETUP, GMAIL_CONNECTED, SEARCH_STRATEGY_CHECKLIST, PROFILE_CONFIRM, INDUSTRY_CONFIRM, FUNCTION_CONFIRM, SALARY_CONFIRM or WORK_AUTHORIZATION. Write the work that comes after setup, aimed at what is actually holding this candidate back. Where relevant, reference real features of this platform: joining the Community Board (posting a job/project/intro or expressing interest in one), requesting a reference, uploading a work sample, adding a job posting for fit feedback (these carry no actionType).
   - HARD REQUIREMENT: write every item's "text" in this exact shape: a short action name (3-6 words, no reasoning in it) + " — " + one short clause on why it matters, in plain language a candidate would find compelling. Example: "Add AI evidence to your resume — it is the skill employers ask for that you do not show." The UI hyperlinks only the part before the dash, so the action name must stand alone as something clickable; never put the reason before the dash or omit the dash.
   - HARD REQUIREMENT — scope: this report's action plan is job goals, resume, positioning and personalization only. Never write networking, outreach, networking lists, LinkedIn posting or Search Sprint items ("commit to your first Search Sprint," "build your network," "ask someone for help"): those live in the Dossier (see the Portfolio page), not here, and are never in the plan.
   - Resume: write the specific changes a resume needs (name the section or bullet and the change, tagged actionType "RESUME_UPDATE"), grounded in the resume analysis below. Never write a generic "apply the suggestions" or "upload your resume" item: those are added automatically.
   - Make most of the items progress on "Currently open gaps" (see candidate data below) rather than generic advice; when a gap lists an existing platform resource, point the candidate at it by name instead of re-deriving generic advice unrelated to any open gap.
   - If any job posting has landed an interview (see "Interview landed" below), mention it and point them to this platform's own generated interview prep for that job, tagged actionType "INTERVIEW_PREP", rather than re-deriving interview advice yourself.
   - If any job posting has an offer (see "Offer received" below), mention it and point them to this platform's own generated negotiation advice for that job, tagged actionType "NEGOTIATION_ADVICE", rather than re-deriving negotiation advice yourself.
`
