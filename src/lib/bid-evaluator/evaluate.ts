/**
 * Gates, fit score, verdict and route for one opportunity. Pure: the profile (read from the document), NextChapter's
 * facts, and the context (past winners, partners, relationship) in; a result out. Tested in src/test/bid-evaluator.test.ts.
 *
 * A gate never fails on a missing fact: it says which fact is needed (UNKNOWN). Only a stated requirement that a known
 * fact does not meet is a BLOCK.
 */
import type { Profile } from './profile'
import { isKnown, parseAggregate, parseMoney, parseStates, soc2Rank, yearsInBusiness, type Facts } from './facts'

export type GateStatus = 'PASS' | 'FIXABLE' | 'SUB_ONLY' | 'BLOCK' | 'UNKNOWN'

export interface Gate {
  key: string
  label: string
  status: GateStatus
  detail: string
}

export type Verdict = 'GO' | 'GO_SUB' | 'RFI' | 'WATCH' | 'NO' | 'CLOSED' | 'NOT_A_BID'
export type Route = 'PRIME' | 'SUB' | 'PARTNER_APPLIES' | 'TRAINING_LIST' | 'RFI_RESPONSE' | 'NONE'

export interface PastWinner { name: string; detail: string; amount: number | null; isCompetitor: boolean }
export interface Partner { name: string; why: string; warm: boolean; orgId: string | null }

export interface EvalContext {
  pastWinners: PastWinner[]
  partners: Partner[]
  /** Warm or hot people at the issuer in the CRM. */
  warmContactsAtIssuer: number
  /** Known competitors named anywhere in the document text. */
  competitorsInText: string[]
}

export interface EvalResult {
  verdict: Verdict
  route: Route
  score: number
  headline: string
  gates: Gate[]
  fit: { factor: string; points: number; max: number; why: string }[]
  answers: { question: string; answer: string }[]
  nextSteps: string[]
  missingFacts: string[]
  pastWinners: PastWinner[]
  partners: Partner[]
}

const DAY = 86_400_000

const ETPL_STEPS =
  'Getting on a training list (ETPL): each state runs its own list through its workforce agency. Apply per program (course): name, length, cost, the credential or skill gain it leads to, delivery mode, and for continued eligibility its completion and employment results. Initial approval usually lasts one year. One approved program lets every board in that state pay for it with training accounts. Start with the state named here.'

const SUB_STEPS =
  'Subcontracting: find who will apply (the partners below, or the past winners), call them before the due date, offer the piece we deliver (training, platform, or coaching for the professional participants) with a price and a letter of commitment they can attach, and agree in writing what share and which outcomes are ours.'

function gate(key: string, label: string, status: GateStatus, detail: string): Gate {
  return { key, label, status, detail }
}

export function evaluate(p: Profile, facts: Facts, ctx: EvalContext, now: Date): EvalResult {
  const gates: Gate[] = []
  const missing = new Set<string>()
  const need = (key: string) => { missing.add(key) }

  // ── Not a bid / closed ──
  const due = p.dates.due ? new Date(p.dates.due) : null
  const closed = p.status === 'CLOSED' || (!!due && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime() - DAY)

  // ── Who can apply ──
  const fp = p.whoCanApply.forProfitAllowed
  if (p.whoCanApply.individualsOnly) gates.push(gate('applicant', 'Who can apply', 'BLOCK', 'Individuals only, not companies.'))
  else if (p.whoCanApply.collegesOnly) gates.push(gate('applicant', 'Who can apply', 'SUB_ONLY', 'Only colleges can apply. NextChapter can be the provider inside a college’s award.'))
  else if (fp === 'NO') gates.push(gate('applicant', 'Who can apply', 'SUB_ONLY', `For-profits cannot apply (${p.whoCanApply.applicantTypes.join(', ') || 'see notice'}). Only as a contractor or subrecipient of an eligible applicant.`))
  else if (fp === 'UNCLEAR') gates.push(gate('applicant', 'Who can apply', 'UNKNOWN', 'The document does not say whether for-profits may apply. Ask before the questions deadline.'))
  else gates.push(gate('applicant', 'Who can apply', 'PASS', fp === 'YES' ? 'For-profits may apply.' : 'Open to firms and consultants.'))

  // ── Training list ──
  const etpl = parseStates(facts.etplStates)
  if (p.trainingList.required === 'YES') {
    const onIt = !!p.state && etpl.includes(p.state.toUpperCase())
    gates.push(gate('trainingList', 'Training provider list', onIt ? 'PASS' : 'FIXABLE',
      onIt ? `On the ${p.state} list.` : `Must be on ${p.trainingList.listName ?? 'the state training provider list'}${p.state ? ` (${p.state})` : ''}. ${p.trainingList.howToGetOn ?? ''}`.trim()))
    if (!isKnown(facts, 'etplStates')) need('etplStates')
  }

  // ── Place ──
  const registered = parseStates(facts.statesRegistered)
  if (p.place.inStateRequired) {
    const inState = !!p.state && (facts.incorporationState?.toUpperCase() === p.state.toUpperCase())
    gates.push(gate('place', 'Located in state', inState ? 'PASS' : 'SUB_ONLY', inState ? 'Located in the state.' : `Bidder must be located in ${p.state ?? 'the state'}. Only as a sub to an in-state prime.`))
  } else if (p.place.registrationRequired) {
    const ok = !!p.state && registered.includes(p.state.toUpperCase())
    gates.push(gate('registration', 'State registration', ok ? 'PASS' : isKnown(facts, 'statesRegistered') ? 'FIXABLE' : 'UNKNOWN', ok ? `Registered in ${p.state}.` : `${p.place.registrationRequired}. Register as a foreign corporation / vendor before the due date (days to weeks).`))
    if (!isKnown(facts, 'statesRegistered')) need('statesRegistered')
  }
  if (p.place.onSiteRequired) gates.push(gate('onSite', 'On-site delivery', 'SUB_ONLY', 'Requires on-site staff, a job center or in-person teaching. NextChapter delivers remotely: only as a partner to whoever staffs it.'))

  // ── Years in business ──
  const yrs = yearsInBusiness(facts, now)
  if (p.requirements.yearsInBusinessMin) {
    if (yrs === null) { need('incorporatedOn'); gates.push(gate('years', 'Years in business', 'UNKNOWN', `Needs ${p.requirements.yearsInBusinessMin} years; incorporation date not on file.`)) }
    else gates.push(gate('years', 'Years in business', yrs >= p.requirements.yearsInBusinessMin ? 'PASS' : 'SUB_ONLY', `Needs ${p.requirements.yearsInBusinessMin}; we have ${yrs}.`))
  }
  if (p.requirements.pastPerformanceRequired) {
    gates.push(gate('pastPerformance', 'Past performance', isKnown(facts, 'pastPerformance') ? 'UNKNOWN' : 'SUB_ONLY',
      `Requires: ${p.requirements.pastPerformanceRequired}. ${isKnown(facts, 'pastPerformance') ? 'Check our results against it.' : 'No results on file: a prime with the history would have to carry it.'}`))
    if (!isKnown(facts, 'pastPerformance')) need('pastPerformance')
  }

  // ── SOC 2 ──
  if (p.requirements.soc2 !== 'NOT_MENTIONED') {
    const r = soc2Rank(facts)
    if (r === null) { need('soc2'); gates.push(gate('soc2', 'SOC 2', 'UNKNOWN', `SOC 2 ${p.requirements.soc2.toLowerCase()}; our status not on file.`)) }
    else if (p.requirements.soc2 === 'REQUIRED') gates.push(gate('soc2', 'SOC 2', r >= 2 ? 'PASS' : 'BLOCK', r >= 2 ? `We have ${facts.soc2}.` : `Required; we have ${facts.soc2}.`))
    else gates.push(gate('soc2', 'SOC 2', r >= 2 ? 'PASS' : 'FIXABLE', `Preferred; we have ${facts.soc2}. Costs points, not eligibility.`))
  }

  // ── Insurance ──
  for (const ins of p.requirements.insurance) {
    const wanted = parseMoney(ins.amount)
    const line = ins.line.toLowerCase()
    const key = /professional|e&o|errors/.test(line) ? 'insProfessional' : /general|gl\b|commercial/.test(line) ? 'insGeneral' : /cyber/.test(line) ? 'insCyber' : /worker/.test(line) ? 'insWorkersComp' : /auto/.test(line) ? 'insAuto' : null
    if (!key) continue
    if (!isKnown(facts, key)) { need(key); gates.push(gate(`ins:${key}`, `Insurance: ${ins.line}`, 'UNKNOWN', `${ins.amount} required; ours not on file.`)); continue }
    const have = key === 'insWorkersComp' ? (facts[key] === 'Yes' ? Infinity : 0) : key === 'insGeneral' ? parseAggregate(facts[key]) : parseMoney(facts[key])
    const ok = wanted === null || (have ?? 0) >= wanted
    gates.push(gate(`ins:${key}`, `Insurance: ${ins.line}`, ok ? 'PASS' : 'FIXABLE', ok ? `${ins.amount} required; held.` : `${ins.amount} required; we hold ${facts[key]}. Raise the limit before award.`))
  }

  // ── Federal registration, certifications, audit, match, cash flow ──
  if (p.requirements.samUeiRequired) {
    gates.push(gate('sam', 'SAM.gov registration (UEI)', isKnown(facts, 'samUei') ? 'PASS' : 'FIXABLE', isKnown(facts, 'samUei') ? `UEI ${facts.samUei}.` : 'Required. Register at SAM.gov (free; allow several weeks).'))
    if (!isKnown(facts, 'samUei')) need('samUei')
  }
  if (p.requirements.certificationsRequired.length) {
    const held = (facts.certifications ?? '').toLowerCase()
    const lacking = p.requirements.certificationsRequired.filter((c) => !held.includes(c.toLowerCase()))
    gates.push(gate('certs', 'Required certifications', lacking.length ? 'BLOCK' : 'PASS', lacking.length ? `Requires ${lacking.join(', ')}.` : 'Held.'))
  }
  if (p.requirements.auditRequired) {
    const f = facts.financials
    gates.push(gate('audit', 'Audit / financial statements', !f ? 'UNKNOWN' : f === 'Audited' ? 'PASS' : 'FIXABLE', !f ? 'Required; our financials status not on file.' : `Required; we have: ${f}.`))
    if (!f) need('financials')
  }
  if (p.requirements.matchRequired) gates.push(gate('match', 'Match / cost share', 'SUB_ONLY', `${p.requirements.matchRequired}. A partner must bring the match.`))
  if (p.money.paidAfterSpending) {
    const cap = parseMoney(facts.cashFloat)
    if (cap === null) { need('cashFloat'); gates.push(gate('cash', 'Paid after spending', 'UNKNOWN', 'Cost-reimbursement: set how much we can float.')) }
    else if (p.money.ceilingUsd) {
      const monthly = p.money.ceilingUsd / 12
      gates.push(gate('cash', 'Paid after spending', monthly * 2 <= cap ? 'PASS' : 'FIXABLE', `About $${Math.round(monthly * 2).toLocaleString('en-US')} out before the first reimbursement (two months); we can float $${cap.toLocaleString('en-US')}.`))
    }
  }
  for (const k of p.requirements.otherKnockouts) gates.push(gate(`other:${k.slice(0, 20)}`, 'Other condition', 'UNKNOWN', k))

  // ── Fit (0–100) ──
  const fit: EvalResult['fit'] = []
  const lines = p.serviceLines
  const lineScore = (['training', 'software', 'coaching'] as const).reduce((s, k) => s + (lines[k].eligible === 'YES' ? 1 : lines[k].eligible === 'UNCLEAR' ? 0.4 : 0), 0)
  fit.push({ factor: 'Scope: training, software, coaching', points: Math.round(Math.min(1, lineScore / 2) * 30), max: 30, why: (['training', 'software', 'coaching'] as const).map((k) => `${k} ${lines[k].eligible.toLowerCase()}`).join(', ') })
  const pop = p.trainees.youthOnly ? 0 : p.trainees.includesProfessionals === 'YES' ? 15 : p.trainees.includesProfessionals === 'UNCLEAR' ? 7 : 2
  fit.push({ factor: 'Who is served', points: pop, max: 15, why: p.trainees.who ?? 'Not stated' })
  const lose = p.scoring.filter((s) => /region|local|presence|past performance|reference|history|hub|minority|veteran|small business|years/i.test(s.criterion)).reduce((n, s) => n + (s.points ?? 0), 0)
  const total = p.scoring.reduce((n, s) => n + (s.points ?? 0), 0)
  const win = total > 0 ? Math.round((1 - lose / total) * 20) : 10
  fit.push({ factor: 'Scoring we can win', points: win, max: 20, why: total > 0 ? `${lose} of ${total} points go to regional presence, history, references or certifications.` : 'No point weights stated.' })
  const minC = parseMoney(facts.minContract)
  const size = p.money.ceilingUsd == null ? 5 : minC != null && p.money.ceilingUsd < minC ? 2 : 10
  fit.push({ factor: 'Size', points: size, max: 10, why: p.money.ceilingUsd != null ? `$${Math.round(p.money.ceilingUsd).toLocaleString('en-US')}` : 'Value not stated' })
  const rel = ctx.warmContactsAtIssuer > 0 ? 10 : 0
  fit.push({ factor: 'Relationship', points: rel, max: 10, why: rel ? `${ctx.warmContactsAtIssuer} warm contact(s) at the issuer.` : 'No warm contact at the issuer.' })
  const comp = ctx.pastWinners.some((w) => w.isCompetitor) || ctx.competitorsInText.length ? 2 : 5
  fit.push({ factor: 'Competition', points: comp, max: 5, why: ctx.competitorsInText.length ? `Named in the document: ${ctx.competitorsInText.join(', ')}.` : ctx.pastWinners.length ? `${ctx.pastWinners.length} past winner(s) at this buyer.` : 'No known competitor wins here.' })
  const strat = (p.results.measures.length ? 3 : 0) + (p.trainingList.required === 'YES' ? 4 : 0) + (/ai|artificial intelligence|reskill|dislocated|layoff/i.test(`${p.title} ${p.trainingSubject ?? ''}`) ? 3 : 0)
  fit.push({ factor: 'Strategic value', points: Math.min(10, strat), max: 10, why: 'AI reskilling or dislocated-worker subject, a training-list door, measurable results.' })
  const score = fit.reduce((n, f) => n + f.points, 0)

  // ── Verdict and route ──
  const has = (s: GateStatus) => gates.some((g) => g.status === s)
  let verdict: Verdict
  let route: Route
  if (!p.isSolicitation) { verdict = 'NOT_A_BID'; route = 'NONE' }
  else if (closed) { verdict = 'CLOSED'; route = 'NONE' }
  else if (has('BLOCK')) { verdict = 'NO'; route = 'NONE' }
  else if (lineScore === 0 && p.trainees.includesProfessionals === 'NO') { verdict = 'NO'; route = 'NONE' }
  else if (p.kind === 'FORECAST') { verdict = 'WATCH'; route = has('SUB_ONLY') ? 'SUB' : 'PRIME' }
  else if (p.kind === 'RFI') { verdict = score >= 40 ? 'RFI' : 'NO'; route = 'RFI_RESPONSE' }
  else if (has('SUB_ONLY')) {
    route = p.kind === 'GRANT' ? 'PARTNER_APPLIES' : 'SUB'
    verdict = score >= 50 && p.subcontracting.allowed !== 'NO' ? 'GO_SUB' : 'NO'
  } else {
    route = p.trainingList.required === 'YES' && !gates.find((g) => g.key === 'trainingList' && g.status === 'PASS') ? 'TRAINING_LIST' : 'PRIME'
    verdict = score >= 55 ? 'GO' : score >= 40 ? 'WATCH' : 'NO'
  }

  const block = gates.find((g) => g.status === 'BLOCK' || g.status === 'SUB_ONLY')
  const headline =
    verdict === 'NOT_A_BID' ? 'Not something to bid on (a form, notice or listing page).'
      : verdict === 'CLOSED' ? 'Closed.'
        : verdict === 'NO' ? (block ? `No: ${block.detail}` : `No: weak fit (${score}/100).`)
          : verdict === 'GO_SUB' ? `Go as a subcontractor (${score}/100): ${block?.detail ?? ''}`
            : verdict === 'RFI' ? `Respond to the RFI (${score}/100). No contract, but it puts us in the pool.`
              : verdict === 'WATCH' ? `Watch (${score}/100).`
                : `Go (${score}/100).`

  // ── The questions asked of every opportunity ──
  const lineAns = (k: 'training' | 'software' | 'coaching') => `${lines[k].eligible === 'YES' ? 'Yes' : lines[k].eligible === 'NO' ? 'No' : 'Unclear'}: ${lines[k].why}`
  const answers = [
    { question: 'Must we be on a training list?', answer: p.trainingList.required === 'YES' ? `Yes: ${p.trainingList.listName ?? 'state ETPL'}. ${p.trainingList.howToGetOn ?? ETPL_STEPS}` : p.trainingList.required === 'NO' ? 'No.' : 'Not stated.' },
    { question: 'Can we subcontract, and to whom?', answer: `${p.subcontracting.allowed === 'YES' ? 'Allowed' : p.subcontracting.allowed === 'LIMITED' ? `Limited${p.subcontracting.limit ? ` (${p.subcontracting.limit})` : ''}` : p.subcontracting.allowed === 'NO' ? 'Not allowed' : 'Not stated'}.${p.subcontracting.expectedPrimes.length ? ` Expected leads: ${p.subcontracting.expectedPrimes.join(', ')}.` : ''}` },
    { question: 'Only for colleges?', answer: p.whoCanApply.collegesOnly ? 'Yes.' : `No. Who can apply: ${p.whoCanApply.applicantTypes.join(', ') || 'not stated'}.` },
    { question: 'Who is being trained or served?', answer: p.trainees.who ?? 'Not stated.' },
    { question: 'What is being trained?', answer: p.trainingSubject ?? 'Not stated.' },
    { question: 'What results are required?', answer: p.results.measures.length ? `${p.results.measures.join('; ')}${p.results.payTiedToResults ? ' (pay tied to results)' : ''}` : 'None stated.' },
    { question: 'Eligible for training?', answer: lineAns('training') },
    { question: 'Eligible for software?', answer: lineAns('software') },
    { question: 'Eligible for coaching?', answer: lineAns('coaching') },
    { question: 'Years in business required?', answer: p.requirements.yearsInBusinessMin ? `${p.requirements.yearsInBusinessMin} (we have ${yrs ?? 'unknown'})` : `None stated (we have ${yrs ?? 'unknown'}).` },
    { question: 'SOC 2?', answer: `${p.requirements.soc2 === 'NOT_MENTIONED' ? 'Not mentioned' : p.requirements.soc2 === 'REQUIRED' ? 'Required' : 'Preferred'}. Ours: ${facts.soc2 || 'not on file'}.${p.requirements.securityOther ? ` Also: ${p.requirements.securityOther}.` : ''}` },
    { question: 'Who has won before?', answer: [...new Set([...p.incumbentsOrPastWinners, ...ctx.pastWinners.map((w) => w.name), ...ctx.competitorsInText])].join(', ') || 'None found.' },
  ]

  const nextSteps: string[] = []
  if (verdict === 'GO' || verdict === 'GO_SUB' || verdict === 'RFI' || verdict === 'WATCH') {
    if (p.dates.questionsDue) nextSteps.push(`Send questions by ${p.dates.questionsDue}${p.contact.email ? ` to ${p.contact.email}` : ''}.`)
    if (p.dates.preBidConference) nextSteps.push(`Pre-bid conference: ${p.dates.preBidConference}.`)
    if (route === 'TRAINING_LIST') nextSteps.push(ETPL_STEPS)
    if (route === 'SUB' || route === 'PARTNER_APPLIES') nextSteps.push(SUB_STEPS)
    for (const g of gates.filter((x) => x.status === 'FIXABLE')) nextSteps.push(`${g.label}: ${g.detail}`)
  }

  return { verdict, route, score, headline, gates, fit, answers, nextSteps, missingFacts: [...missing], pastWinners: ctx.pastWinners, partners: ctx.partners }
}

export const VERDICT_LABEL: Record<Verdict | 'UNREAD', string> = {
  GO: 'Go', GO_SUB: 'Go as sub', RFI: 'Respond to RFI', WATCH: 'Watch', NO: 'No', CLOSED: 'Closed', NOT_A_BID: 'Not a bid', UNREAD: 'Not read',
}
export const ROUTE_LABEL: Record<Route, string> = {
  PRIME: 'We bid as prime', SUB: 'Subcontract under a prime', PARTNER_APPLIES: 'A partner applies; we deliver', TRAINING_LIST: 'Get on the training list', RFI_RESPONSE: 'RFI response', NONE: '—',
}
