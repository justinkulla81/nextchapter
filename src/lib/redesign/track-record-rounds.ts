// The track record questionnaire as short rounds. The twenty questions, the fields saved, in seven rounds of three at most.
// Pure: question definitions, round order, the payoff, the finish, and the conversion to and from the saved row.
// track-record-rounds.test.ts covers it.

import type { TrackRecordResponse } from '@prisma/client'
import {
  APPROVAL_AUTHORITY_OPTIONS,
  COMPANY_STAGE_HISTORY_OPTIONS,
  CROSS_FUNCTIONAL_AREA_OPTIONS,
  DROVE_OUTCOMES_LABELS,
  INDUSTRY_SECTOR_OPTIONS,
  MANDATE_CLARITY_LABELS,
  OPERATING_SITUATION_OPTIONS,
  TRACK_RECORD_BOARD_EXPOSURE_LABELS,
  TRACK_RECORD_DOLLAR_BAND_LABELS,
  TRACK_RECORD_DOLLAR_BAND_ORDER,
  TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS,
  TRACK_RECORD_PNL_LABELS,
  TRACK_RECORD_REPORTED_TO_LABELS,
  TRACK_RECORD_SIZE_BAND_LABELS,
  TRACK_RECORD_SIZE_BAND_ORDER,
  TRACK_RECORD_TENURE_BAND_LABELS,
  TRACK_RECORD_TENURE_BAND_ORDER,
} from '@/lib/constants/track-record'
import {
  joinList,
  optionLabels,
  pctAnswered,
  questionOf,
  roundQuestions,
  totalAnswered,
  type FlowDef,
  type RoundAnswers,
  type RoundDef,
  type RoundOption,
  type RoundQuestion,
} from '@/lib/redesign/rounds'

const YES_NO: RoundOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

const fromOrder = <T extends string>(order: readonly T[], labels: Record<T, string>): RoundOption[] => order.map((value) => ({ value, label: labels[value] }))
const fromLabels = <T extends string>(labels: Record<T, string>): RoundOption[] => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
const scale = (labels: readonly string[]): RoundOption[] => labels.map((label, i) => ({ value: String(i + 1), label }))
const plain = (opts: readonly RoundOption[]): RoundOption[] => opts.map((o) => ({ value: o.value, label: o.label }))

const SIZE = fromOrder(TRACK_RECORD_SIZE_BAND_ORDER, TRACK_RECORD_SIZE_BAND_LABELS)
const DOLLARS = fromOrder(TRACK_RECORD_DOLLAR_BAND_ORDER, TRACK_RECORD_DOLLAR_BAND_LABELS)

export const TRACK_RECORD_QUESTIONS: readonly RoundQuestion[] = [
  { id: 'isPeopleManager', kind: 'buttons', label: 'Have you been a people manager?', options: YES_NO, factLabel: 'People manager' },
  { id: 'largestTeamManaged', kind: 'select', label: 'Largest team you have managed directly', options: SIZE, factLabel: 'Largest team managed' },
  { id: 'peopleHiredDirectly', kind: 'select', label: 'How many people have you hired directly?', options: SIZE, factLabel: 'People hired directly' },
  { id: 'largestOrgIndirect', kind: 'select', label: 'Largest organization you have influenced indirectly', help: 'Dotted-line or cross-functional, without them reporting to you.', options: SIZE, factLabel: 'Largest organization influenced' },
  { id: 'reportedToLevel', kind: 'select', label: 'Highest level you have reported to', options: fromLabels(TRACK_RECORD_REPORTED_TO_LABELS), factLabel: 'Highest level reported to' },
  { id: 'geographicScope', kind: 'buttons', label: 'Geographic scope of the roles you have held', options: fromLabels(TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS), factLabel: 'Geographic scope' },
  { id: 'budgetOwned', kind: 'select', label: 'Largest budget you have owned', options: DOLLARS, factLabel: 'Largest budget owned' },
  { id: 'pnlAccountability', kind: 'buttons', label: 'P&L accountability', options: fromLabels(TRACK_RECORD_PNL_LABELS), factLabel: 'P&L accountability' },
  { id: 'largestInitiativeScope', kind: 'select', label: 'Largest single initiative you have owned, by dollar impact', options: DOLLARS, factLabel: 'Largest initiative' },
  { id: 'approvalAuthority', kind: 'multi', label: 'Which of these could you approve without escalating?', options: plain(APPROVAL_AUTHORITY_OPTIONS), exclusive: 'NONE', factLabel: 'Could approve' },
  { id: 'boardExposure', kind: 'buttons', label: 'Board exposure', options: fromLabels(TRACK_RECORD_BOARD_EXPOSURE_LABELS), factLabel: 'Board exposure' },
  { id: 'ledThroughRestructuring', kind: 'buttons', label: 'Have you led a team through a layoff, restructuring or significant downsizing?', options: YES_NO, factLabel: 'Led through restructuring' },
  { id: 'situationRanking', kind: 'rank', label: 'Rank these by how often you have operated this way', help: 'Pick the most frequent first.', options: plain(OPERATING_SITUATION_OPTIONS), max: 4, factLabel: 'Most often' },
  { id: 'mandateClarity', kind: 'buttons', label: 'When you stepped into a new role, how clear was your mandate?', options: scale(MANDATE_CLARITY_LABELS), factLabel: 'Mandate' },
  { id: 'droveOutcomesThroughOthers', kind: 'buttons', label: 'How often has your impact come through directing other people’s work, rather than your own?', options: scale(DROVE_OUTCOMES_LABELS), factLabel: 'Impact through others' },
  { id: 'functionsOwnedOutsideCore', kind: 'multi', label: 'Which functions have you owned outside your core discipline?', options: plain(CROSS_FUNCTIONAL_AREA_OPTIONS), factLabel: 'Functions owned outside your core' },
  { id: 'sectorHistory', kind: 'multi', label: 'Which sectors have you worked in?', options: plain(INDUSTRY_SECTOR_OPTIONS), factLabel: 'Sectors' },
  { id: 'stageHistory', kind: 'multi', label: 'Which company stages have you worked in?', options: plain(COMPANY_STAGE_HISTORY_OPTIONS), factLabel: 'Company stages' },
  { id: 'longestTenure', kind: 'select', label: 'Longest you have stayed in one role', options: fromOrder(TRACK_RECORD_TENURE_BAND_ORDER, TRACK_RECORD_TENURE_BAND_LABELS), factLabel: 'Longest in one role' },
  { id: 'accomplishmentToConfirm', kind: 'text', label: 'One accomplishment you would want a reference to confirm', help: 'It becomes a specific question we ask your references to confirm, add to or correct.', placeholder: 'For example: rebuilt the onboarding funnel and cut time to first value by half', maxLength: 500, factLabel: 'Accomplishment to confirm' },
]

export const TRACK_RECORD_ROUNDS: readonly RoundDef[] = [
  { id: 'people', title: 'The people you have led', why: 'Hiring managers read team size and hiring first. A résumé rarely says how many people you led or hired.', feeds: ['Dossier', 'Strengths'], questionIds: ['isPeopleManager', 'largestTeamManaged', 'peopleHiredDirectly'] },
  { id: 'reach', title: 'Your reach', why: 'Influence without authority and the level you reported to show how senior your work really was.', feeds: ['Dossier', 'Strengths'], questionIds: ['largestOrgIndirect', 'reportedToLevel', 'geographicScope'] },
  { id: 'money', title: 'The money you owned', why: 'Budget, P&L and the biggest initiative are the numbers a hiring manager uses to size you against a role.', feeds: ['Dossier', 'Strengths'], questionIds: ['budgetOwned', 'pnlAccountability', 'largestInitiativeScope'] },
  { id: 'authority', title: 'Authority and tough calls', why: 'What you could decide without asking, and whether you have led through a downsizing, tells an employer how much trust you carried.', feeds: ['Dossier'], questionIds: ['approvalAuthority', 'boardExposure', 'ledThroughRestructuring'] },
  { id: 'style', title: 'How you operate', why: 'Whether you build, scale, fix or run things decides which roles suit you, and your references are asked to confirm it.', feeds: ['Dossier', 'Reference check'], questionIds: ['situationRanking', 'mandateClarity', 'droveOutcomesThroughOthers'] },
  { id: 'breadth', title: 'Your range', why: 'Functions you have owned and sectors you have worked in open roles beyond the one on your résumé.', feeds: ['Dossier', 'Other roles you could do'], questionIds: ['functionsOwnedOutsideCore', 'sectorHistory', 'stageHistory'] },
  { id: 'proof', title: 'Staying power and proof', why: 'Your longest tenure and one accomplishment a reference can confirm are what make the rest believable.', feeds: ['Dossier', 'Reference check'], questionIds: ['longestTenure', 'accomplishmentToConfirm'] },
]

export const TRACK_RECORD_FIELD_IDS = TRACK_RECORD_QUESTIONS.map((q) => q.id)

/** The saved row (and the people-manager flag that lives on the profile) as answers. A null is an open question. */
export function answersFromTrackRecord(row: Partial<TrackRecordResponse> | null | undefined, isPeopleManager: boolean | null | undefined): RoundAnswers {
  const a: RoundAnswers = {}
  const put = (id: string, v: string | string[] | number | boolean | null | undefined) => {
    if (v === null || v === undefined) return
    const list = Array.isArray(v) ? v : [typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)]
    const clean = list.filter((x) => x.trim() !== '')
    if (clean.length > 0) a[id] = clean
  }
  put('isPeopleManager', isPeopleManager)
  if (!row) return a
  put('largestTeamManaged', row.largestTeamManaged)
  put('peopleHiredDirectly', row.peopleHiredDirectly)
  put('largestOrgIndirect', row.largestOrgIndirect)
  put('reportedToLevel', row.reportedToLevel)
  put('geographicScope', row.geographicScope)
  put('budgetOwned', row.budgetOwned)
  put('pnlAccountability', row.pnlAccountability)
  put('largestInitiativeScope', row.largestInitiativeScope)
  put('approvalAuthority', row.approvalAuthority)
  put('boardExposure', row.boardExposure)
  put('ledThroughRestructuring', row.ledThroughRestructuring)
  put('situationRanking', row.situationRanking)
  put('mandateClarity', row.mandateClarity)
  put('droveOutcomesThroughOthers', row.droveOutcomesThroughOthers)
  put('functionsOwnedOutsideCore', row.functionsOwnedOutsideCore)
  put('sectorHistory', row.sectorHistory)
  put('stageHistory', row.stageHistory)
  put('longestTenure', row.longestTenure)
  put('accomplishmentToConfirm', row.accomplishmentToConfirm)
  return a
}

/**
 * The columns a round writes: only the questions it answered, in the same shape the long form saves
 * (enums as strings, scales as integers, yes/no as a boolean, lists as arrays). `isPeopleManager` is not a column
 * of the track record; it is returned apart because it lives on the profile.
 */
export function trackRecordUpdate(answers: RoundAnswers): { row: Record<string, unknown>; isPeopleManager: boolean | null } {
  const row: Record<string, unknown> = {}
  let isPeopleManager: boolean | null = null
  for (const [id, values] of Object.entries(answers)) {
    const q = questionOf(TRACK_RECORD_FLOW, id)
    if (!q || values.length === 0) continue
    if (id === 'isPeopleManager') isPeopleManager = values[0] === 'yes'
    else if (id === 'ledThroughRestructuring') row[id] = values[0] === 'yes'
    else if (id === 'mandateClarity' || id === 'droveOutcomesThroughOthers') row[id] = Number(values[0])
    else if (q.kind === 'multi' || q.kind === 'rank') row[id] = values
    else row[id] = values[0]
  }
  return { row, isPeopleManager }
}

const dossierFact = (q: RoundQuestion, answers: RoundAnswers): string | null => {
  const labels = optionLabels(q, answers)
  if (labels.length === 0) return null
  switch (q.id) {
    case 'functionsOwnedOutsideCore':
      return `Other roles you could do counts ${joinList(labels)} as functions you have owned.`
    case 'accomplishmentToConfirm':
      return `Your references will be asked to confirm: “${labels[0]}”`
    case 'isPeopleManager':
    case 'ledThroughRestructuring':
      return `${q.factLabel}: ${labels[0].toLowerCase()}`
    case 'situationRanking':
      return `${q.factLabel}: ${labels.join(', then ').toLowerCase()}`
    default:
      return `${q.factLabel}: ${joinList(labels)}`
  }
}

export function trackRecordPayoff(answers: RoundAnswers, round: RoundDef) {
  const here = roundQuestions(TRACK_RECORD_FLOW, round)
  const facts = here.map((q) => dossierFact(q, answers)).filter((f): f is string => !!f)
  const total = totalAnswered(TRACK_RECORD_FLOW, answers)
  const n = TRACK_RECORD_QUESTIONS.length
  if (facts.length === 0) {
    return { headline: 'Answer to add this to your dossier.', lines: [`${total} of ${n} facts are in your dossier so far.`], chips: [...round.feeds] }
  }
  return {
    headline: `${total} of ${n} facts are in your dossier.`,
    lines: facts,
    chips: [...round.feeds],
  }
}

export function trackRecordFinish(answers: RoundAnswers) {
  const n = TRACK_RECORD_QUESTIONS.length
  const total = totalAnswered(TRACK_RECORD_FLOW, answers)
  const has = (id: string) => (answers[id] ?? []).length > 0
  const gains = [{ place: 'Dossier', title: `${total} of ${n} scope facts are in your dossier`, detail: 'Hiring managers see them next to your résumé.' }]
  if (['largestTeamManaged', 'largestOrgIndirect', 'budgetOwned', 'pnlAccountability', 'largestInitiativeScope'].some(has)) {
    gains.push({ place: 'Strengths', title: 'Your scope is compared with others in your function', detail: 'Your strengths page shows where your team size, budget and initiatives sit.' })
  }
  const ownedFunctions = (answers.functionsOwnedOutsideCore ?? []).length
  if (ownedFunctions > 0) {
    gains.push({ place: 'Learn', title: `Other roles you could do counts ${ownedFunctions} ${ownedFunctions === 1 ? 'function' : 'functions'} you have owned`, detail: 'Role ideas and learning paths start from them.' })
  }
  if (has('accomplishmentToConfirm')) {
    gains.push({ place: 'Network', title: 'Your references will be asked to confirm one accomplishment', detail: 'It is added to the questions they answer about you.' })
  }
  const open = n - total
  return { headline: open === 0 ? 'Your track record is complete.' : `Your track record is ${pctAnswered(TRACK_RECORD_FLOW, answers)}% complete.`, gains, open, pct: pctAnswered(TRACK_RECORD_FLOW, answers) }
}

export const TRACK_RECORD_FLOW: FlowDef = {
  id: 'track_record',
  eventPrefix: 'track_record',
  title: 'Track record',
  why: 'Scope and ownership are what a résumé cannot show. Your answers build your dossier, and one becomes a question we ask your references to confirm.',
  gets: 'Your team size, budget and range in your dossier, and role ideas that start from what you have owned.',
  secondsPerRound: 40,
  questions: TRACK_RECORD_QUESTIONS,
  rounds: TRACK_RECORD_ROUNDS,
  payoff: trackRecordPayoff,
  finish: trackRecordFinish,
}
