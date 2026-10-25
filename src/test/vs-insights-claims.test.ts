import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPETITOR_COMPARISONS } from '@/lib/marketing/competitor-comparisons'

// Comparison claims on /vs/* and /insights/* (CLAUDE.md, docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md):
// no only/first/no other/unlike claims, every statement about NextChapter has a substantiation row,
// and nothing is stated about a competitor without evidence. data/competitor-matrix/ has no researched
// cells for the vendors named on /vs, so the competitor columns must be questions.

const ROOT = process.cwd()

function pageFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...pageFiles(rel))
    else if (/\.(tsx?|ts)$/.test(e.name)) out.push(rel)
  }
  return out
}

const FILES = [
  ...pageFiles('src/app/vs'),
  ...pageFiles('src/app/insights'),
  'src/lib/marketing/competitor-comparisons.ts',
  'src/components/marketing/ComparisonPageTemplate.tsx',
  'src/lib/seo/insights.ts',
]

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

const SUPERLATIVES =
  /\b(only|first|no other|unlike|nobody|no one|almost nobody|best|leading|most vendors|most providers|the industry|honest(ly)?|genuinely|fastest|lowest|cheapest|number one)\b|#1/i

const doc = readFileSync(join(ROOT, 'docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md'), 'utf8')
const docRows = new Map<string, string>()
for (const line of doc.split('\n')) {
  const m = line.match(/^\|\s*(VS-\d+)\s*\|/)
  if (m) docRows.set(m[1], line)
}

describe('/vs and /insights comparison claims', () => {
  it.each(FILES)('%s has no unsubstantiated superlatives', (file) => {
    // Copy only: class names (leading-relaxed) are not claims.
    const src = stripComments(readFileSync(join(ROOT, file), 'utf8')).replace(/className="[^"]*"/g, '')
    const hit = src.match(SUPERLATIVES)
    expect(hit?.[0], `${file} contains "${hit?.[0]}"; remove it or add a dated evidence row and an explicit exception`).toBeUndefined()
  })

  const refs = COMPETITOR_COMPARISONS.flatMap((c) => [
    ...c.featureComparison.map((r) => r.substantiationRef),
    c.whatParticipantsKeep.substantiationRef,
    c.whatTheEmployerSees.substantiationRef,
  ])

  it('every substantiationRef has a row in the substantiation file marked OK', () => {
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of new Set(refs)) {
      const row = docRows.get(ref)
      expect(row, `no ${ref} row in docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md`).toBeDefined()
      expect(row, `${ref} must be marked OK`).toMatch(/\|\s*OK\b/)
      expect(row, `${ref} must name its evidence`).toMatch(/src\/|`op_|`reference_/)
    }
  })

  it('competitor columns are questions, never statements about the vendor', () => {
    for (const c of COMPETITOR_COMPARISONS) {
      const asks = [...c.featureComparison.map((r) => r.ask), c.whatParticipantsKeep.ask, c.whatTheEmployerSees.ask]
      for (const a of asks) expect(a, `${c.slug}: "${a}"`).toMatch(/\?|^Ask\b/)
    }
  })

  it('names no competitor in a NextChapter statement and states no per-vendor claim', () => {
    for (const c of COMPETITOR_COMPARISONS) {
      for (const r of c.featureComparison) expect(r.us).not.toMatch(/LHH|RiseSmart|Randstad|Careerminds|INTOO|compared|than/i)
    }
  })
})
