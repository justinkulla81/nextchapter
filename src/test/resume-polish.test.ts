import { describe, expect, it } from 'vitest'
import { ruleFix } from '@/lib/resume/studio/polish-rules'
import { checkBullet, checkEdit } from '@/lib/resume/studio/polish-guard'
import { applySegment, segmentsOf } from '@/lib/resume/studio/polish-segments'
import { evidenceQuestions, findWritingFixes, strongerBullet, type BulletContext } from '@/lib/resume/studio/polish'
import { sampleDocument } from './fixtures/resume-sample-document'

describe('ruleFix', () => {
  it('fixes the spacing slips an uploaded resume really has', () => {
    expect(ruleFix('New York,NY')?.replacement).toBe('New York, NY')
    expect(ruleFix('Tel Aviv,Israel')?.replacement).toBe('Tel Aviv, Israel')
    expect(ruleFix('for Technology Entrepreneurship  without Borders courses')?.replacement).toBe('for Technology Entrepreneurship without Borders courses')
    expect(ruleFix('support 500k MAUs.Modernized the stack')?.replacement).toBe('support 500k MAUs. Modernized the stack')
    expect(ruleFix('led the the team')?.replacement).toBe('led the team')
    expect(ruleFix('revenue , margin')?.replacement).toBe('revenue, margin')
  })
  it('leaves correct text, figures, abbreviations and addresses alone', () => {
    for (const ok of ['New York, NY', 'Raised $1,000,000 from 3,000 donors', 'Served on U.S. Small Business Administration', 'Worked at e.g. Google', 'jordan@example.com', 'https://example.com/a,b', 'Series A, B and C']) {
      expect(ruleFix(ok)).toBeNull()
    }
  })
})

describe('checkEdit', () => {
  const o = 'Recieved the One Bank Award for leading the Sarbanes-Oxley program.'
  it('accepts a small correction', () => {
    expect(checkEdit(o, 'Received the One Bank Award for leading the Sarbanes-Oxley program.').ok).toBe(true)
  })
  it('rejects a changed figure', () => {
    expect(checkEdit('Grew revenue 26% in 2019.', 'Grew revenue 28% in 2019.')).toEqual({ ok: false, reason: 'figures changed' })
  })
  it('rejects a rewrite, a new name, and a short name respelled', () => {
    expect(checkEdit(o, 'Won the prestigious One Bank Award for spearheading the entire compliance program at the firm.').ok).toBe(false)
    expect(checkEdit('Invested in Knix and Xero Shoes.', 'Invested in Nix and Xero Shoes.').ok).toBe(false)
    expect(checkEdit('Worked with Google on checkout.', 'Worked with Amazon on checkout.').ok).toBe(false)
  })
  it('allows a long name to be respelled by a letter or two', () => {
    expect(checkEdit('Studied at Harvrad University in 2009.', 'Studied at Harvard University in 2009.').ok).toBe(true)
  })
})

describe('checkBullet', () => {
  const facts = { original: 'Responsible for the sales pipeline at Acme.', answers: ['I ran 12 reps and grew pipeline 40% in a year'], context: ['Sales Director', 'Acme'] }
  it('accepts a bullet built from the answers', () => {
    expect(checkBullet(facts, 'Led 12 reps and grew the Acme sales pipeline 40% in one year.').ok).toBe(true)
  })
  it('rejects an invented figure or name', () => {
    expect(checkBullet(facts, 'Led 15 reps and grew the Acme sales pipeline 40% in one year.').ok).toBe(false)
    expect(checkBullet(facts, 'Led 12 reps and grew the Acme sales pipeline 40% using Salesforce.').ok).toBe(false)
  })
  it('rejects dropping a figure the original had', () => {
    const f = { original: 'Cut month-end close from 9 days to 5 across 4 entities.', answers: [], context: ['Controller', 'Acme'] }
    expect(checkBullet(f, 'Shortened the month-end close across several entities.').ok).toBe(false)
    expect(checkBullet(f, 'Cut the month-end close from 9 days to 5 across 4 entities.').ok).toBe(true)
  })
})

describe('segments', () => {
  it('applies a fix only while the text still reads as it did', () => {
    const doc = sampleDocument()
    const seg = segmentsOf(doc).find((s) => s.id === 'role:0:location')!
    expect(seg.text).toBe('New York,NY')
    const next = applySegment(doc, seg.id, seg.text, 'New York, NY')!
    expect(next.workHistory[0].location).toBe('New York, NY')
    expect(doc.workHistory[0].location).toBe('New York,NY') // the original is untouched
    expect(applySegment(next, seg.id, seg.text, 'x')).toBeNull() // already changed
    expect(applySegment(doc, 'role:99:title', 'a', 'b')).toBeNull()
  })
})

describe('findWritingFixes', () => {
  it('runs the rules, asks the model about the rest, and drops anything the guard refuses', async () => {
    const doc = sampleDocument()
    doc.workHistory[5].bullets[0] = 'Served as CTO, leading a 25-person engineering team. Modernized the tech stak to support 500k MAUs.'
    const calls: string[][] = []
    const r = await findWritingFixes(doc, async (segs) => {
      calls.push(segs.map((s) => s.id))
      return {
        fixes: [
          { id: 'role:5:bullet:0', replacement: 'Served as CTO, leading a 25-person engineering team. Modernized the tech stack to support 500k MAUs.', kind: 'spelling', reason: '“stak” is spelled “stack”.' },
          { id: 'role:6:bullet:0', replacement: 'Worked on the deal team for the Series B investment for HootSuite (most recently valued at $900M).', kind: 'grammar', reason: 'made up' },
          { id: 'role:0:location', replacement: 'Boston, MA', kind: 'grammar', reason: 'a rule already handled this piece' },
        ],
      }
    })
    const ids = r.fixes.map((f) => f.id)
    expect(ids).toContain('role:0:location') // from the rule
    expect(r.fixes.find((f) => f.id === 'role:0:location')?.source).toBe('rule')
    expect(r.fixes.find((f) => f.id === 'role:5:bullet:0')?.source).toBe('model')
    expect(ids).not.toContain('role:6:bullet:0') // changed a figure and a name: refused
    expect(calls[0]).not.toContain('role:0:location') // the model never saw a piece the rules fixed
    expect(r.modelRan).toBe(true)
  })
})

describe('evidence and stronger bullets', () => {
  const ctx: BulletContext = { roleTitle: 'Sales Director', companyName: 'Acme', dates: '2019-2022', bullet: 'Responsible for the sales pipeline.', otherBullets: [] }
  it('drops a question that assumes a number', async () => {
    const q = await evidenceQuestions(ctx, async () => ({ questions: [{ question: 'How many of your 12 reps hit quota?', why: 'x' }, { question: 'How many reps did you manage?', why: 'Team size shows scope.' }] }))
    expect(q.map((x) => x.question)).toEqual(['How many reps did you manage?'])
  })
  it('retries once with the reason, then gives a bullet built only from what was said', async () => {
    const seen: (string | null)[] = []
    const r = await strongerBullet(ctx, [{ question: 'How many reps?', answer: '12 reps, pipeline up 40%' }], async (_c, _a, fb) => {
      seen.push(fb)
      return seen.length === 1 ? { bullet: 'Led 20 reps and grew pipeline 40%.', changed: 'x' } : { bullet: 'Led 12 reps and grew the sales pipeline 40%.', changed: 'Added team size and result.' }
    })
    expect(r).toEqual({ ok: true, bullet: 'Led 12 reps and grew the sales pipeline 40%.', changed: 'Added team size and result.' })
    expect(seen[1]).toContain('figures not given: 20')
  })
  it('says so plainly when it cannot stay within the facts', async () => {
    const r = await strongerBullet(ctx, [], async () => ({ bullet: 'Led 30 reps and grew pipeline 90%.', changed: 'x' }))
    expect(r.ok).toBe(false)
  })
})
