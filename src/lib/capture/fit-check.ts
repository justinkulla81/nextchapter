// The résumé gap check on industry and job-title pages: which of the skills this page's openings ask for a pasted résumé
// already says. Pure and deterministic (no AI, nothing is sent anywhere); the same two inputs always give the same answer.

const ALIASES: Record<string, string[]> = {
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  javascript: ['js'],
  typescript: ['ts'],
  'power bi': ['powerbi'],
  'project management': ['pmp', 'project manager'],
  'financial modeling': ['financial models', 'financial modelling'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#./ ]+/g, ' ').replace(/\s+/g, ' ').trim()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function says(text: string, skill: string): boolean {
  const names = [norm(skill), ...(ALIASES[norm(skill)] ?? [])].filter(Boolean)
  return names.some((n) => new RegExp(`(^|[^a-z0-9])${escape(n)}($|[^a-z0-9])`).test(text))
}

/** Like checkFit, for skills whose résumé wording differs from the label ("ML frameworks (PyTorch, TensorFlow)" is said as "PyTorch"). */
export function checkFitItems(resume: string, items: { label: string; words: string[] }[]): FitResult {
  const text = ` ${norm(resume)} `
  const covered = items.filter((i) => i.words.some((w) => says(text, w))).map((i) => i.label)
  const missing = items.map((i) => i.label).filter((l) => !covered.includes(l))
  return { covered, missing, pct: items.length ? Math.round((covered.length / items.length) * 100) : 0 }
}

export interface FitResult {
  covered: string[]
  missing: string[]
  /** 0 to 100: the share of the page's skills the résumé says. */
  pct: number
}

export function checkFit(resume: string, skills: string[]): FitResult {
  const text = ` ${norm(resume)} `
  const unique = [...new Set(skills.map((s) => s.trim()).filter(Boolean))]
  const covered = unique.filter((s) => says(text, s))
  const missing = unique.filter((s) => !covered.includes(s))
  return { covered, missing, pct: unique.length ? Math.round((covered.length / unique.length) * 100) : 0 }
}

/** Plain words for the score. Never says anything about the person, only about the wording on the résumé. */
export function fitWords(pct: number): string {
  if (pct >= 70) return 'Your résumé already speaks most of this language.'
  if (pct >= 40) return 'Your résumé covers part of what these openings ask for.'
  return 'Your résumé leaves out most of the skills these openings name. That is often wording, not experience.'
}
