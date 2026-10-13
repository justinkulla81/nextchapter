// A member can be connected to several organizations at once: outplacement
// paid for by a former employer, a coach, recruiters, one or more colleges, a
// workforce board, a company's hiring funnel. Each sees only what its own
// rule below allows, and no one of them can change the member's journey in a
// way that silences the others. Pure and client-safe: the Privacy page, the
// docs (docs/AFFILIATIONS.md) and the tests all read this one table.

export type AffiliationKind = 'COACH' | 'OUTPLACEMENT' | 'COLLEGE' | 'RECRUITER' | 'WORKFORCE_BOARD' | 'EMPLOYER_FUNNEL'

export type VisibleField = 'journey' | 'stage' | 'activity' | 'searchDetail' | 'dossier' | 'tone' | 'outcome' | 'mood' | 'screening'

// NONE: never. AGGREGATE: counts only, never named. MEMBER: this person, by name.
export type VisibilityLevel = 'NONE' | 'AGGREGATE' | 'MEMBER'

export type VisibilityRule = { level: VisibilityLevel; needs: string | null }

const none: VisibilityRule = { level: 'NONE', needs: null }
const agg = (needs: string | null = null): VisibilityRule => ({ level: 'AGGREGATE', needs })
const member = (needs: string): VisibilityRule => ({ level: 'MEMBER', needs })

export const VISIBILITY: Record<AffiliationKind, Record<VisibleField, VisibilityRule>> = {
  COACH: {
    journey: member('you agree to share with your coach'),
    stage: member('you agree to share with your coach'),
    activity: member('you agree to share with your coach'),
    searchDetail: member('you agree to share with your coach'),
    dossier: member('you agree to share with your coach'),
    tone: member('you agree to share with your coach'),
    outcome: member('you agree to share with your coach'),
    mood: none,
    screening: none,
  },
  OUTPLACEMENT: {
    journey: none,
    stage: none,
    activity: none,
    searchDetail: none,
    dossier: none,
    tone: none,
    outcome: agg('you turn on sharing your outcome with your former employer'),
    mood: none,
    screening: none,
  },
  COLLEGE: {
    journey: agg('you share engagement with the college'),
    stage: agg('you share engagement with the college'),
    activity: agg('you share engagement with the college'),
    searchDetail: member('you share search detail with career services'),
    dossier: member('you share your Dossier with employers through the college'),
    tone: none,
    outcome: member('you share your outcome with the college'),
    mood: none,
    screening: none,
  },
  RECRUITER: {
    journey: none,
    stage: none,
    activity: none,
    searchDetail: none,
    dossier: member('you opt in to the recruiter database'),
    tone: none,
    outcome: none,
    mood: none,
    screening: none,
  },
  WORKFORCE_BOARD: {
    journey: none,
    stage: none,
    activity: none,
    searchDetail: none,
    dossier: none,
    tone: none,
    outcome: agg('you choose to be counted, anonymously, when you find work'),
    mood: none,
    screening: none,
  },
  EMPLOYER_FUNNEL: {
    journey: none,
    stage: none,
    activity: none,
    searchDetail: none,
    dossier: member('you apply to or accept an introduction from that employer'),
    tone: none,
    outcome: none,
    mood: none,
    screening: none,
  },
}

export const AFFILIATION_LABELS: Record<AffiliationKind, string> = {
  COACH: 'Your coach',
  OUTPLACEMENT: 'Outplacement from your former employer',
  COLLEGE: 'Your college or university',
  RECRUITER: 'Recruiters',
  WORKFORCE_BOARD: 'Workforce board',
  EMPLOYER_FUNNEL: 'A company you are interviewing with',
}

export const FIELD_LABELS: Record<VisibleField, string> = {
  journey: 'Your situation',
  stage: 'Where you are in your search',
  activity: 'Your weekly activity',
  searchDetail: 'Your search details',
  dossier: 'Your Executive Dossier',
  tone: 'How you like to be coached',
  outcome: 'When you land a job',
  mood: 'Your mood check-ins',
  screening: 'Your screening answers',
}

// What this affiliation can see, in plain words, given what the member has
// granted. `granted` is the set of conditions (VisibilityRule.needs) that are on.
export function visibleTo(kind: AffiliationKind, granted: ReadonlySet<string>): { field: VisibleField; level: VisibilityLevel }[] {
  return (Object.entries(VISIBILITY[kind]) as [VisibleField, VisibilityRule][])
    .filter(([, r]) => r.level !== 'NONE' && (r.needs === null || granted.has(r.needs)))
    .map(([field, r]) => ({ field, level: r.level }))
}

// A change made through one affiliation's own screens. The member's journey
// and stage belong to the member, so an affiliation may report a fact (laid
// off, got a job) that is true everywhere, but "no longer looking" at one
// college is that college's own status and must not pause everything else.
export type AffiliationSource = 'COLLEGE' | 'OUTPLACEMENT' | 'COACH' | 'MEMBER'

export function appliesAcrossAffiliations(source: AffiliationSource, change: { stage?: string; journey?: string }): boolean {
  if (source === 'MEMBER') return true
  // Facts that are true for every affiliation.
  if (change.journey === 'LAID_OFF') return true
  if (change.stage === 'LANDED' || change.stage === 'OFFER' || change.stage === 'INTERVIEWING') return true
  // Pausing or going back to exploring is the member's own call, made in their own account.
  return false
}
