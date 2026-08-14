// Release-gate fixture harness — Master Build Script §16
// (docs/specs/NextChapter_PHASE2_MASTER_SCRIPT.md). Exercises the real,
// pure, DB-free layer of the new five-component scoring system directly
// (no mocking of the scoring logic itself) against hand-authored fixtures
// in scripts/scoring-fixtures/. See that directory's README.md for exactly
// which of the 19 gates are covered here and why the rest are deferred.
//
// computeResumePrestige is the one function in this layer that still hits
// Prisma (EliteInstitution/PrestigeEmployer lookups) — vitest.config.ts
// loads no DATABASE_URL, so a real call would throw, and this repo has no
// test-database precedent to call it against safely. It's mocked here,
// nothing else — the mock returns a small, fully-controlled set of
// "elite"/"prestige" rows so gates 2 and 3 (which are specifically about
// prestige) have real signal to assert against, rather than mocking it to
// always return zero and making those gates trivially true.
import { describe, it, expect, vi } from 'vitest'
import { computeAllDimensions, type DimensionContext } from '@/lib/scoring/resume-analysis/dimensions'
import { computeReconciliation, computeExtracurricular, computeResumePrestige } from '@/lib/scoring/resume-analysis/modifiers'
import { detectSeniorityBand } from '@/lib/scoring/resume-analysis/seniority-band'
import { detectFunctionFamily } from '@/lib/scoring/resume-analysis/function-family'
import { getExperienceDimensionWeights, getResumeDimensionWeights } from '@/lib/scoring/resume-analysis/weights'
import { selfCheckResumeAnalysis } from '@/lib/scoring/resume-analysis/self-check'
import { simulateAtsCompatibility } from '@/lib/scoring/resume-analysis/ats-matrix'
import { RESUME_BANDS, EXPERIENCE_BANDS, scoreToExperienceBand, scoreToResumeBand, type ResumeBand } from '@/lib/scoring/resume-analysis/types'
import type { ResumeAnalysisFacts } from '@/lib/scoring/resume-analysis/extract-facts'
import { assertGeneratedFacts, checkFactAppearsInText } from '@/lib/scoring/self-check'
import { GRADE_BAND_DESCRIPTION, type Grade } from '@/lib/scoring/grade'
import { WEEKLY_HOURS_BY_GRADE, REALISTIC_PATH_BY_GRADE } from '@/lib/reports/market-reality-sections'
import { DIFFICULTY_LABEL } from '@/lib/scoring/market-reality/narrative'
import { prisma } from '@/lib/prisma'

import { kwanFacts } from '../../scripts/scoring-fixtures/kwan'
import { solanoFacts } from '../../scripts/scoring-fixtures/solano'
import { hollanderFacts } from '../../scripts/scoring-fixtures/hollander'
import { danforthFacts } from '../../scripts/scoring-fixtures/danforth'
import { whitcombFacts, whitcombFixedFacts } from '../../scripts/scoring-fixtures/whitcomb'
import { kwanAtsBrokenFacts } from '../../scripts/scoring-fixtures/kwan-ats-broken'
import { kwanUnquantifiedFacts } from '../../scripts/scoring-fixtures/kwan-unquantified'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    eliteInstitution: { findMany: vi.fn() },
    prestigeEmployer: { findMany: vi.fn() },
  },
}))

// Controlled, fictional prestige catalog — matches kwan.ts's institution
// and employer names exactly (see that file's own header comment); every
// other fixture's names are deliberately non-matching fiction, so they
// naturally resolve to zero prestige without needing per-fixture mocking.
vi.mocked(prisma.eliteInstitution.findMany).mockResolvedValue([
  {
    id: 'elite-1',
    name: 'Radcliffe Endowed University',
    nameNormalized: 'radcliffe endowed university',
    isActive: true,
    createdAt: new Date('2020-01-01'),
  },
] as never)
vi.mocked(prisma.prestigeEmployer.findMany).mockResolvedValue([
  {
    id: 'prestige-1',
    name: 'Vantage Meridian Group',
    nameNormalized: 'vantage meridian group',
    isActive: true,
    createdAt: new Date('2020-01-01'),
  },
] as never)

// ── Test harness glue — composes the real pure functions exactly the way
// src/lib/scoring/resume-analysis/compute.ts does (same formulas, same
// order), since compute.ts itself is a Prisma-orchestrated function we
// can't call directly against fixtures. This is assembly, not new scoring
// logic: every number below comes from computeAllDimensions/modifiers.ts/
// self-check.ts, called unmodified.
interface FullResult {
  facts: ResumeAnalysisFacts
  band: ReturnType<typeof detectSeniorityBand>
  dimensionScores: ReturnType<typeof computeAllDimensions>['scores']
  dimensionFindings: ReturnType<typeof computeAllDimensions>['findings']
  experienceScore: number
  experienceBand: ReturnType<typeof scoreToExperienceBand>
  resumeScore: number
  resumeBand: ResumeBand
  resumeSubtotalPrePrestige: number
  prestigeBonus: number
  reconciliationPenalty: number
  extracurricularBonus: number
  selfCheckPassed: boolean
  selfCheckErrors: string[]
}

async function computeFull(facts: ResumeAnalysisFacts, targetRoleType: string | null = null): Promise<FullResult> {
  const band = detectSeniorityBand(facts)
  const family = detectFunctionFamily(facts)
  const ctx: DimensionContext = { band, family, targetRoleType, targetIndustries: [] }
  const experienceWeights = getExperienceDimensionWeights(band)
  const resumeWeights = getResumeDimensionWeights(band)
  const { scores: dimensionScores, findings: dimensionFindings } = computeAllDimensions(facts, ctx)

  const prestige = await computeResumePrestige(facts)
  const reconciliation = computeReconciliation(facts)
  const extracurricular = computeExtracurricular(facts, band)

  const experienceSubtotal = Object.entries(experienceWeights).reduce(
    (sum, [key, weight]) => sum + (dimensionScores[key as keyof typeof dimensionScores] * weight) / 100,
    0
  )
  const experienceScore = Math.max(0, Math.min(100, Math.round(experienceSubtotal + extracurricular.bonus)))
  const experienceBand = scoreToExperienceBand(experienceScore)

  const resumeSubtotal = Object.entries(resumeWeights).reduce(
    (sum, [key, weight]) => sum + (dimensionScores[key as keyof typeof dimensionScores] * weight) / 100,
    0
  )
  const resumeScore = Math.max(0, Math.min(100, Math.round(resumeSubtotal + prestige.resumeGradeBonus + reconciliation.penalty)))
  const resumeBand = scoreToResumeBand(resumeScore)

  const selfCheck = selfCheckResumeAnalysis({
    dimensionScores,
    experienceWeights,
    resumeWeights,
    extracurricularBonus: extracurricular.bonus,
    prestigeBonus: prestige.resumeGradeBonus,
    reconciliationPenalty: reconciliation.penalty,
    experienceScore,
    experienceBand,
    resumeScore,
    resumeBand,
    firstGlanceScore: null,
  })

  return {
    facts,
    band,
    dimensionScores,
    dimensionFindings,
    experienceScore,
    experienceBand,
    resumeScore,
    resumeBand,
    resumeSubtotalPrePrestige: Math.max(0, Math.min(100, Math.round(resumeSubtotal + reconciliation.penalty))),
    prestigeBonus: prestige.resumeGradeBonus,
    reconciliationPenalty: reconciliation.penalty,
    extracurricularBonus: extracurricular.bonus,
    selfCheckPassed: selfCheck.passed,
    selfCheckErrors: selfCheck.errors,
  }
}

function resumeBandIndex(band: ResumeBand): number {
  return RESUME_BANDS.findIndex((b) => b.band === band)
}

describe('Scoring release-gate fixture harness (Master Build Script §16)', () => {
  it('gate 1: ordering — Kwan >= Solano > Hollander > Danforth > Whitcomb on Your Experience', async () => {
    const [kwan, solano, hollander, danforth, whitcomb] = await Promise.all([
      computeFull(kwanFacts),
      computeFull(solanoFacts),
      computeFull(hollanderFacts),
      computeFull(danforthFacts),
      computeFull(whitcombFacts),
    ])

    // Kwan and Solano tie exactly on Your Experience by construction (gate
    // 2): prestige is a Resume-only modifier in this engine, and Solano's
    // roles/scope are a deliberate deep clone of Kwan's, so their
    // experienceScore can never legitimately differ. That's correct
    // engine behavior, not a fixture bug — see gate 2 below, which asserts
    // the tie explicitly, and the README's note on why "Your Experience"
    // is prestige-blind by design (§17 rule 5: never display or imply
    // prestige).
    expect(kwan.experienceScore).toBe(solano.experienceScore)
    expect(solano.experienceScore).toBeGreaterThan(hollander.experienceScore)
    expect(hollander.experienceScore).toBeGreaterThan(danforth.experienceScore)
    expect(danforth.experienceScore).toBeGreaterThan(whitcomb.experienceScore)
  })

  it('gate 2: logo isolation — Kwan and Solano have identical pre-prestige base scores', async () => {
    const kwan = await computeFull(kwanFacts)
    const solano = await computeFull(solanoFacts)

    // Every dimension score is computed from facts that never include a
    // company or school name (computeAllDimensions doesn't read either) —
    // so the full 11-dimension score set must be bit-for-bit identical.
    expect(kwan.dimensionScores).toEqual(solano.dimensionScores)
    expect(kwan.extracurricularBonus).toBe(solano.extracurricularBonus)
    expect(kwan.reconciliationPenalty).toBe(solano.reconciliationPenalty)
    expect(kwan.experienceScore).toBe(solano.experienceScore)
    expect(kwan.resumeSubtotalPrePrestige).toBe(solano.resumeSubtotalPrePrestige)

    // The only legitimate difference: Kwan's institution/employer names
    // match the prestige catalog, Solano's deliberately don't.
    expect(kwan.prestigeBonus).toBeGreaterThan(0)
    expect(solano.prestigeBonus).toBe(0)
    expect(kwan.resumeScore).toBeGreaterThan(solano.resumeScore)
  })

  it('gate 3: prestige cap — zeroing prestige never reorders a candidate by more than one Resume band', async () => {
    const candidates = await Promise.all(
      [kwanFacts, solanoFacts, hollanderFacts, danforthFacts, whitcombFacts].map((f) => computeFull(f))
    )

    for (const c of candidates) {
      const zeroedResumeScore = c.resumeSubtotalPrePrestige // resumeSubtotalPrePrestige already excludes prestige
      const zeroedBand = scoreToResumeBand(zeroedResumeScore)
      const shift = Math.abs(resumeBandIndex(c.resumeBand) - resumeBandIndex(zeroedBand))
      expect(shift, `${c.facts.candidateName}: prestige moved the Resume band by ${shift} steps (${zeroedBand} -> ${c.resumeBand})`).toBeLessThanOrEqual(1)
    }

    // And a real, non-trivial case: Kwan's actual prestige bonus is large
    // enough that this assertion has teeth, not just vacuously true because
    // nobody had any prestige to zero.
    const kwan = await computeFull(kwanFacts)
    expect(kwan.prestigeBonus).toBeGreaterThan(0)
  })

  it('gate 4: scope over title — Kwan\'s EVP -> President transition scores as an increase on trajectory', async () => {
    const kwan = await computeFull(kwanFacts)
    // scoreTrajectory's "no comparable data" neutral baseline is 65 —
    // Kwan's real, stated budget growth across all three roles (scope
    // numbers only, title text never read) should land well above that.
    expect(kwan.dimensionScores.trajectory).toBeGreaterThan(65)
    expect(kwan.dimensionScores.trajectory).toBeGreaterThanOrEqual(90)
  })

  it('gate 5: self-check — every fixture reconciles with its own inputs', async () => {
    const allFixtures: [string, ResumeAnalysisFacts][] = [
      ['kwan', kwanFacts],
      ['solano', solanoFacts],
      ['hollander', hollanderFacts],
      ['danforth', danforthFacts],
      ['whitcomb', whitcombFacts],
      ['whitcomb (fixed)', whitcombFixedFacts],
      ['kwan (ATS-broken)', kwanAtsBrokenFacts],
      ['kwan (unquantified)', kwanUnquantifiedFacts],
    ]

    for (const [label, facts] of allFixtures) {
      const result = await computeFull(facts)
      expect(result.selfCheckPassed, `${label}: self-check failed — ${result.selfCheckErrors.join('; ')}`).toBe(true)
    }
  })

  it('gate 5b: assertGeneratedFacts catches a narrative number that disagrees with its source', () => {
    const seniorRole = kwanFacts.roles[0] // SVP Merchandising, headcount 400
    const realHeadcount = seniorRole.headcount as number

    const correct = assertGeneratedFacts([{ label: 'SVP-era team size', asserted: realHeadcount, source: realHeadcount }])
    expect(correct.passed).toBe(true)
    expect(correct.errors).toHaveLength(0)

    const wrong = assertGeneratedFacts([{ label: 'SVP-era team size', asserted: realHeadcount + 50, source: realHeadcount }])
    expect(wrong.passed).toBe(false)
    expect(wrong.errors[0]).toContain('SVP-era team size')
  })

  it('gate 5c: checkFactAppearsInText confirms a source number actually appears in generated prose', () => {
    const realHeadcount = kwanFacts.roles[0].headcount as number
    const goodSentence = `In her SVP role, ${kwanFacts.candidateName} led a team of ${realHeadcount}.`
    const badSentence = `In her SVP role, ${kwanFacts.candidateName} led a large team.`

    expect(checkFactAppearsInText(goodSentence, { label: 'SVP-era team size', source: realHeadcount })).toBe(true)
    expect(checkFactAppearsInText(badSentence, { label: 'SVP-era team size', source: realHeadcount })).toBe(false)
  })

  it('gate 7 (release blocker): movement is real — applying Whitcomb\'s actual top fixes moves his Resume band', async () => {
    const base = await computeFull(whitcombFacts)

    // Confirm the three findings this gate fixes are real, actual output
    // of the engine today — not assumed.
    const quantificationCopy = base.dimensionFindings.quantification.map((f) => f.candidateFacingCopy).join(' | ')
    expect(quantificationCopy).toContain('describes a duty, not a result')

    const narrativeCopy = base.dimensionFindings.narrativePositioning.map((f) => f.candidateFacingCopy).join(' | ')
    expect(narrativeCopy).toContain('never says what you want next')

    const mechanicsCopy = base.dimensionFindings.mechanicsPresentation.map((f) => f.candidateFacingCopy).join(' | ')
    expect(mechanicsCopy).toContain('quaterly')

    // Every one of those findings carries a real, specific fix.
    for (const dim of ['quantification', 'narrativePositioning', 'mechanicsPresentation'] as const) {
      for (const finding of base.dimensionFindings[dim]) {
        expect(finding.fix.length, `${dim} finding "${finding.candidateFacingCopy}" has no fix`).toBeGreaterThan(0)
      }
    }

    // whitcombFixedFacts (scripts/scoring-fixtures/whitcomb.ts) applies
    // exactly those three fixes and nothing else. Recompute and assert the
    // band actually moved — this is the release-blocker assertion. If this
    // fails, that's a real signal about the scoring engine, not a fixture
    // problem to paper over.
    const fixed = await computeFull(whitcombFixedFacts)
    const improvement = resumeBandIndex(base.resumeBand) - resumeBandIndex(fixed.resumeBand)
    expect(
      improvement,
      `Whitcomb's Resume band did not move after applying his own top fixes (${base.resumeBand} -> ${fixed.resumeBand}). ` +
        'This is a release blocker per §16 gate 7, not a fixture-authoring issue: it means fixing real, ' +
        'engine-identified problems does not move the number.'
    ).toBeGreaterThanOrEqual(1)
  })

  it('gate 8: function fairness — an engineering fixture with zero revenue metrics is not penalized on Quantification', async () => {
    const hollander = await computeFull(hollanderFacts)
    const danforth = await computeFull(danforthFacts)

    // Bullet shape (from/to pairs, one per bullet) is deliberately matched
    // 1:1 between the two fixtures (see hollander.ts/danforth.ts headers),
    // so outcomeRatio/baselineRatio/numberDensity — and therefore the
    // Quantification score itself — must come out identical.
    expect(hollander.dimensionScores.quantification).toBe(danforth.dimensionScores.quantification)

    // And explicitly: no finding penalizes Hollander for lacking revenue
    // numbers specifically.
    const hollanderFindingCopy = hollander.dimensionFindings.quantification.map((f) => f.candidateFacingCopy).join(' | ')
    expect(hollanderFindingCopy).not.toMatch(/revenue/i)
  })

  it('gate 9: band fairness — an early-career one-pager is not penalized for its length or thin extracurricular content', async () => {
    const whitcomb = await computeFull(whitcombFacts)

    // Not crushed into the bottom two bands (D/F) purely for being
    // early-career/thin — EXPERIENCE_BANDS is ordered best (A, index 0) to
    // worst (F, index 8); "not in the bottom two" means index <= 6.
    const bandIndex = EXPERIENCE_BANDS.findIndex((b) => b.band === whitcomb.experienceBand)
    expect(bandIndex, `Whitcomb landed in ${whitcomb.experienceBand}`).toBeLessThanOrEqual(6)

    // Modest ($120K) but real scope clears the EARLY-band norm ($100K)
    // comfortably — the low bar for the band is doing its job, not zeroing
    // out a candidate who has any number at all.
    expect(whitcomb.dimensionScores.scopeLevel).toBeGreaterThanOrEqual(80)

    // A single, non-governance extracurricular entry still earns real
    // credit at EARLY band (full-weight decay, vs. 0.3-0.4x at
    // SENIOR/EXECUTIVE) — thin board content isn't scaled down further for
    // being early-career.
    expect(whitcomb.extracurricularBonus).toBeGreaterThan(0)

    // Normal tenure (both roles clear the 18-month threshold for the
    // function) draws no short-tenure penalty.
    expect(whitcomb.dimensionScores.tenurePattern).toBe(100)
  })

  it('gate 14: component separation — ATS-broken Kwan drops Your Resume sharply while Your Experience is unchanged', async () => {
    const kwan = await computeFull(kwanFacts)
    const atsBroken = await computeFull(kwanAtsBrokenFacts)

    expect(atsBroken.experienceScore).toBe(kwan.experienceScore)
    expect(atsBroken.dimensionScores.atsLegibility).toBeLessThanOrEqual(25)
    expect(kwan.resumeScore - atsBroken.resumeScore).toBeGreaterThanOrEqual(15)

    // The ATS parser matrix (a separate, independent read of the same hard
    // failures) agrees: strict/legacy platforms fail outright, and nothing
    // reads clean.
    const matrix = simulateAtsCompatibility(kwanAtsBrokenFacts)
    const taleo = matrix.find((row) => row.parserKey === 'TALEO')
    expect(taleo?.severity).toBe('FAILING')
    expect(matrix.every((row) => row.severity !== 'CLEAN')).toBe(true)
  })

  it('gate 14b: component separation — unquantified Kwan drops Your Resume via Quantification while Your Experience is unchanged', async () => {
    const kwan = await computeFull(kwanFacts)
    const unquantified = await computeFull(kwanUnquantifiedFacts)

    expect(unquantified.experienceScore).toBe(kwan.experienceScore)
    expect(kwan.dimensionScores.quantification - unquantified.dimensionScores.quantification).toBeGreaterThanOrEqual(30)
    expect(kwan.resumeScore).toBeGreaterThan(unquantified.resumeScore)
  })

  it('gate 18 (partial): every Finding produced by the fixtures carries a non-empty fix', async () => {
    const allFixtures = [kwanFacts, solanoFacts, hollanderFacts, danforthFacts, whitcombFacts, kwanAtsBrokenFacts, kwanUnquantifiedFacts]
    const results = await Promise.all(allFixtures.map((f) => computeFull(f)))

    for (const result of results) {
      for (const findingsForDimension of Object.values(result.dimensionFindings)) {
        for (const finding of findingsForDimension) {
          expect(finding.fix).toBeTruthy()
          expect(finding.fix.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('gate 6/19 (scoped to deterministic templates): grade-keyed copy tables are exhaustive and never contradict their own band', () => {
    const ALL_GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F']
    const CELEBRATORY = /\b(excellent|congratulations|exceptional|rare)\b/i
    const CONSOLATION = /\b(don't worry|it's okay|rebuild before|not your fault)\b/i

    const tables: Record<string, Record<Grade, string>> = {
      WEEKLY_HOURS_BY_GRADE,
      REALISTIC_PATH_BY_GRADE,
      DIFFICULTY_LABEL,
      GRADE_BAND_DESCRIPTION,
    }

    for (const [tableName, table] of Object.entries(tables)) {
      // Exhaustive across every real grade band — no band falls through to
      // an undefined/missing template. TypeScript's Record<Grade, string>
      // already forces this at compile time; this runtime check guards
      // against a future refactor loosening that type without anyone
      // noticing a band silently went missing.
      for (const grade of ALL_GRADES) {
        expect(table[grade], `${tableName} is missing a template for grade ${grade}`).toBeTruthy()
      }

      // A D/F band's copy shouldn't read as celebratory; an A/B band's
      // shouldn't read as consolation for a bad outcome.
      for (const grade of ['D', 'F'] as Grade[]) {
        expect(table[grade], `${tableName}[${grade}] reads as celebratory`).not.toMatch(CELEBRATORY)
      }
      for (const grade of ['A', 'B'] as Grade[]) {
        expect(table[grade], `${tableName}[${grade}] reads as consolation`).not.toMatch(CONSOLATION)
      }
    }

    // Whitcomb himself: whichever band his fixture lands in, the
    // deterministic templates for that band read as a route forward, not
    // just a diagnosis — REALISTIC_PATH_BY_GRADE names at least one
    // concrete lever for every grade, including F.
    for (const grade of ALL_GRADES) {
      expect(REALISTIC_PATH_BY_GRADE[grade]).toMatch(/\b(fix|apply|reframe|coaching|warm|rebuild|skills|interim)\b/i)
    }
  })
})
