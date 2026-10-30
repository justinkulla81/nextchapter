// Pure logic for the AI job check: which related jobs are a better bet, and which skills they ask for that you may lack.
// No database here, so it is tested on its own (src/test/ai-check.test.ts).

/** A related occupation with the numbers needed to compare it to the one the visitor typed. */
export interface Alt {
  soc6: string
  title: string
  /** 0-1 skill and knowledge similarity to the visitor's job. */
  similarity: number
  /** Observed AI exposure, 0-1; null when not measured. */
  exposure: number | null
  /** BLS national median annual wage; null when suppressed. */
  medianWage: number | null
}

export type BetReason = 'pays_more' | 'less_exposed'

export interface Bet extends Alt {
  reasons: BetReason[]
  /** alt wage minus current wage when both are known. */
  payDelta: number | null
}

/** A related job must pay at least this much more to count as paying more (a rounding-error raise is not a reason to switch). */
export const PAYS_MORE_RATIO = 1.05
/** And be this much lower on the 0-1 exposure scale to count as less exposed (the bands are 0.1 and 0.3 wide). */
export const LESS_EXPOSED_BY = 0.05
/** A less-exposed job only counts when its pay is known and within this share of the visitor's: no advice to take a pay cut. */
export const MIN_PAY_FOR_LESS_EXPOSED = 0.9
export const MAX_BETS = 5

export function pickBets(current: { soc6: string; exposure: number | null; medianWage: number | null }, alts: Alt[], max = MAX_BETS): Bet[] {
  const seen = new Set<string>([current.soc6])
  const bets: Bet[] = []
  for (const a of alts) {
    if (seen.has(a.soc6)) continue
    seen.add(a.soc6)
    const reasons: BetReason[] = []
    const paysMore = current.medianWage != null && a.medianWage != null && a.medianWage >= current.medianWage * PAYS_MORE_RATIO
    const keepsPay = current.medianWage == null || (a.medianWage != null && a.medianWage >= current.medianWage * MIN_PAY_FOR_LESS_EXPOSED)
    const lessExposed = current.exposure != null && a.exposure != null && a.exposure <= current.exposure - LESS_EXPOSED_BY && keepsPay
    if (paysMore) reasons.push('pays_more')
    if (lessExposed) reasons.push('less_exposed')
    if (reasons.length === 0) continue
    bets.push({ ...a, reasons, payDelta: current.medianWage != null && a.medianWage != null ? a.medianWage - current.medianWage : null })
  }
  return bets.sort((x, y) => y.reasons.length - x.reasons.length || y.similarity - x.similarity).slice(0, max)
}

/** A skill, knowledge area or tool with its O*NET importance rescaled to 0-100. */
export type SkillLevels = ReadonlyMap<string, number>

/** A target must rate a skill at least this important, and the visitor's job this much lower, for it to be a gap. */
export const GAP_MIN_TARGET = 60
export const GAP_MIN_DIFF = 15
export const MAX_GAP_SKILLS = 5

/**
 * Skills the better-bet jobs lean on that the current job does not. A skill the current job does not list counts as 0, so a
 * tool or knowledge area that is simply absent shows up as a gap. Averaged over the targets, largest gap first.
 */
export function skillsGap(current: SkillLevels, targets: SkillLevels[], max = MAX_GAP_SKILLS): string[] {
  if (targets.length === 0) return []
  const names = new Set<string>()
  for (const t of targets) for (const n of t.keys()) names.add(n)
  const gaps: { name: string; gap: number }[] = []
  for (const name of names) {
    const target = targets.reduce((sum, t) => sum + (t.get(name) ?? 0), 0) / targets.length
    const mine = current.get(name) ?? 0
    if (target >= GAP_MIN_TARGET && target - mine >= GAP_MIN_DIFF) gaps.push({ name, gap: target - mine })
  }
  return gaps.sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name)).slice(0, max).map((g) => g.name)
}
