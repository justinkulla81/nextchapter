import { describe, expect, it } from 'vitest'
import { evaluate, type EvalContext } from '@/lib/bid-evaluator/evaluate'
import { parseAggregate, parseMoney, parseStates, yearsInBusiness } from '@/lib/bid-evaluator/facts'
import { pickDocLinks } from '@/lib/bid-evaluator/fetch-doc'
import type { Profile } from '@/lib/bid-evaluator/profile'

const NOW = new Date('2026-11-24T12:00:00Z')
const ctx: EvalContext = { pastWinners: [], partners: [], warmContactsAtIssuer: 0, competitorsInText: [] }

function profile(over: Partial<Profile> = {}): Profile {
  const base: Profile = {
    isSolicitation: true, kind: 'RFP', status: 'OPEN', title: 'AI reskilling for dislocated workers', issuer: 'Board', state: 'MA', summary: '',
    dates: { due: '2026-12-15', dueText: null, questionsDue: '2026-12-01', preBidConference: null, rolling: false },
    submission: { method: null, format: null, pageLimit: null },
    whoCanApply: { applicantTypes: ['for-profit firms'], forProfitAllowed: 'YES', collegesOnly: false, individualsOnly: false, quote: null },
    trainingList: { required: 'NO', listName: null, howToGetOn: null, quote: null },
    subcontracting: { allowed: 'YES', limit: null, expectedPrimes: [], quote: null },
    place: { inStateRequired: false, registrationRequired: null, inStatePreference: false, regionalKnowledgeScored: false, onSiteRequired: false, remoteAllowed: 'YES', quote: null },
    serviceLines: { training: { eligible: 'YES', why: '' }, software: { eligible: 'YES', why: '' }, coaching: { eligible: 'UNCLEAR', why: '' } },
    trainees: { who: 'Laid-off professionals', includesProfessionals: 'YES', youthOnly: false, count: null },
    trainingSubject: 'AI skills',
    results: { measures: ['Employment Q2 after exit'], payTiedToResults: false },
    requirements: { yearsInBusinessMin: null, pastPerformanceRequired: null, soc2: 'NOT_MENTIONED', securityOther: null, accessibility: null, insurance: [], certificationsRequired: [], bonusCertifications: [], samUeiRequired: false, auditRequired: false, matchRequired: null, otherKnockouts: [], quote: null },
    money: { contractType: 'fixed', ceilingUsd: 50000, term: null, paidAfterSpending: false, rateCaps: null, quote: null },
    incumbentsOrPastWinners: [], scoring: [], minimumScore: null, responseComponents: [], contact: { name: null, email: null, phone: null },
  }
  return { ...base, ...over }
}

describe('bid evaluator', () => {
  it('says Go on an open, in-scope RFP with no gates', () => {
    const r = evaluate(profile(), {}, ctx, NOW)
    expect(r.verdict).toBe('GO')
    expect(r.route).toBe('PRIME')
  })

  it('sends a for-profit-barred grant to the partner route, never prime', () => {
    const p = profile({ kind: 'GRANT', whoCanApply: { applicantTypes: ['nonprofits'], forProfitAllowed: 'NO', collegesOnly: false, individualsOnly: false, quote: null } })
    const r = evaluate(p, {}, ctx, NOW)
    expect(r.route).toBe('PARTNER_APPLIES')
    expect(['GO_SUB', 'NO']).toContain(r.verdict)
  })

  it('says No to individuals-only and closed items', () => {
    expect(evaluate(profile({ whoCanApply: { applicantTypes: [], forProfitAllowed: 'YES', collegesOnly: false, individualsOnly: true, quote: null } }), {}, ctx, NOW).verdict).toBe('NO')
    expect(evaluate(profile({ dates: { due: '2026-11-01', dueText: null, questionsDue: null, preBidConference: null, rolling: false } }), {}, ctx, NOW).verdict).toBe('CLOSED')
  })

  it('never fails a gate on a missing fact: SOC 2 required with no fact on file is unknown', () => {
    const p = profile({ requirements: { ...profile().requirements, soc2: 'REQUIRED' } })
    const r = evaluate(p, {}, ctx, NOW)
    expect(r.gates.find((g) => g.key === 'soc2')?.status).toBe('UNKNOWN')
    expect(r.missingFacts).toContain('soc2')
    expect(evaluate(p, { soc2: 'None' }, ctx, NOW).verdict).toBe('NO')
    expect(evaluate(p, { soc2: 'Type II' }, ctx, NOW).gates.find((g) => g.key === 'soc2')?.status).toBe('PASS')
  })

  it('routes a training-list requirement to getting on the list', () => {
    const p = profile({ trainingList: { required: 'YES', listName: 'Massachusetts ETPL', howToGetOn: null, quote: null } })
    expect(evaluate(p, {}, ctx, NOW).route).toBe('TRAINING_LIST')
    expect(evaluate(p, { etplStates: 'MA, TX' }, ctx, NOW).route).toBe('PRIME')
  })

  it('checks insurance limits and years in business', () => {
    const p = profile({ requirements: { ...profile().requirements, yearsInBusinessMin: 3, insurance: [{ line: 'Errors and omissions', amount: '$1,000,000' }] } })
    const r = evaluate(p, { insProfessional: '500k', incorporatedOn: '2025-01-15' }, ctx, NOW)
    expect(r.gates.find((g) => g.key === 'ins:insProfessional')?.status).toBe('FIXABLE')
    expect(r.gates.find((g) => g.key === 'years')?.status).toBe('SUB_ONLY')
  })

  it('answers the fixed questions for every opportunity', () => {
    const q = evaluate(profile(), {}, ctx, NOW).answers.map((a) => a.question)
    expect(q).toEqual(expect.arrayContaining(['Must we be on a training list?', 'Only for colleges?', 'Eligible for coaching?', 'SOC 2?', 'Who has won before?']))
  })
})

describe('fact parsers', () => {
  it('reads money, aggregates, states and years', () => {
    expect(parseMoney('$1,000,000')).toBe(1_000_000)
    expect(parseMoney('500k')).toBe(500_000)
    expect(parseAggregate('1000000/2000000')).toBe(2_000_000)
    expect(parseStates('ma, tx; Ohio')).toEqual(['MA', 'TX'])
    expect(yearsInBusiness({ incorporatedOn: '2020-06-01' }, NOW)).toBe(6)
    expect(yearsInBusiness({}, NOW)).toBeNull()
  })
})

describe('pickDocLinks', () => {
  it('prefers the solicitation PDF over forms and Q&A', () => {
    const html = `<a href="/f/budget-form.pdf">Budget form</a><a href="/f/One-Stop-RFP.pdf">One Stop Operator RFP</a><a href="/about">About</a>`
    expect(pickDocLinks(html, 'https://x.org/rfp', 'One Stop Operator RFP')[0]).toBe('https://x.org/f/One-Stop-RFP.pdf')
  })
})
