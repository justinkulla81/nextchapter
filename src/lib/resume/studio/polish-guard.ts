import { tokenize } from '@/lib/resume/studio/fidelity'

/**
 * What a suggested change may and may not do. The model proposes; these checks decide whether the proposal is shown.
 * They exist because the failure that matters is an AI that "improves" a resume by changing a figure, a name or a
 * claim. Nothing that fails a check reaches the person.
 */

const hasDigit = (t: string) => /\d/.test(t)
const figures = (text: string) => tokenize(text).filter(hasDigit)

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const m = new Map<string, number>()
  for (const x of a) m.set(x, (m.get(x) ?? 0) + 1)
  for (const x of b) {
    const n = m.get(x)
    if (!n) return false
    m.set(x, n - 1)
  }
  return true
}

/** Words that start with a capital letter and are not the first word of the text: names, companies, products. */
function namedThings(text: string): string[] {
  const words = text.split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean)
  return words.slice(1).filter((w) => /^\p{Lu}/u.test(w)).map((w) => w.toLowerCase())
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** Words of `b` that are not in the longest run of words shared with `a`, in order. */
function changedWords(a: string[], b: string[]): { removed: string[]; added: string[] } {
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const removed: string[] = []
  const added: string[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) removed.push(a[i++])
    else added.push(b[j++])
  }
  while (i < a.length) removed.push(a[i++])
  while (j < b.length) added.push(b[j++])
  return { removed, added }
}

export type EditCheck = { ok: true } | { ok: false; reason: string }

/**
 * A spelling, grammar or punctuation fix: small, and it keeps every figure and name. A name may be respelled only
 * when the new spelling is within two letters of the old one, which catches "Harvrad" without letting "Knix" become "Nix".
 */
export function checkEdit(original: string, replacement: string): EditCheck {
  const a = original.trim()
  const b = replacement.trim()
  if (!b) return { ok: false, reason: 'empty' }
  if (a === b) return { ok: false, reason: 'unchanged' }
  if (!sameMultiset(figures(a), figures(b))) return { ok: false, reason: 'figures changed' }
  const ratio = b.length / a.length
  if (ratio < 0.75 || ratio > 1.3) return { ok: false, reason: 'too different in length' }
  const aw = a.split(/\s+/)
  const bw = b.split(/\s+/)
  const { removed, added } = changedWords(aw.map((w) => w.toLowerCase()), bw.map((w) => w.toLowerCase()))
  if (Math.max(removed.length, added.length) > Math.max(3, Math.ceil(aw.length * 0.2))) return { ok: false, reason: 'rewrites more than a fix' }
  const before = new Set(namedThings(a))
  const removedNames = removed.filter((w) => before.has(w.replace(/[^\p{L}\p{N}]/gu, '')))
  for (const n of namedThings(b)) {
    if (before.has(n)) continue
    // A new capitalised word is only allowed as the respelling of a name that was removed.
    // Short names are never respelled: "Knix" must not become "Nix".
    const respelled = removedNames.some((r) => {
      const old = r.replace(/[^\p{L}\p{N}]/gu, '')
      return old.length >= 6 && n.length >= 6 && editDistance(old, n) <= 2
    })
    if (!respelled) return { ok: false, reason: `new name “${n}”` }
  }
  return { ok: true }
}

export interface BulletFacts {
  /** The bullet as it stands, if there is one. */
  original: string | null
  /** What the person said in answer to the questions. */
  answers: string[]
  /** The job title and company the bullet sits under. */
  context: string[]
}

/**
 * A stronger bullet may use only what is already there or what the person just said: every figure and every name
 * in it must appear in the original bullet, an answer, or the job's own title and company. Anything else is invented.
 */
export function checkBullet(facts: BulletFacts, output: string): EditCheck {
  const out = output.trim()
  if (out.length < 20 || out.length > 400) return { ok: false, reason: 'length' }
  if (/^(i|my|me)\b/i.test(out)) return { ok: false, reason: 'first person' }
  if (facts.original && out === facts.original.trim()) return { ok: false, reason: 'unchanged' }
  const source = [facts.original ?? '', ...facts.answers, ...facts.context].join('\n')
  const allowedFigures = new Set(figures(source))
  const invented = figures(out).filter((f) => !allowedFigures.has(f))
  if (invented.length > 0) return { ok: false, reason: `figures not given: ${[...new Set(invented)].join(', ')}` }
  // Every figure in the original must survive too: a rewrite that drops a number has lost evidence.
  const kept = new Set(figures(out))
  const dropped = figures(facts.original ?? '').filter((f) => !kept.has(f))
  if (dropped.length > 0) return { ok: false, reason: `figures dropped: ${[...new Set(dropped)].join(', ')}` }
  const sourceWords = new Set(tokenize(source))
  const inventedNames = namedThings(out).filter((n) => !tokenize(n).every((t) => sourceWords.has(t)))
  if (inventedNames.length > 0) return { ok: false, reason: `names not given: ${[...new Set(inventedNames)].join(', ')}` }
  return { ok: true }
}
