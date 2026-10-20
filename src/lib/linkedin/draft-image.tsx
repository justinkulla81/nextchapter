import 'server-only'
import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import { LAYOUTS, type DraftFacts } from './layoff-post-rules'

const SOURCE_LABEL: Record<DraftFacts['credibility'], string> = {
  'warn-filing': 'State WARN filing',
  'sec-filing': 'SEC filing',
  'two-publishers': 'Multiple news reports',
  'trusted-outlet': 'News report',
}

/**
 * The picture for a LinkedIn draft, drawn from its own facts: how many jobs,
 * which employer, where, and how we know. Four layouts in rotation so the
 * cards do not all look alike. Shared by the admin preview route and the
 * post action, so what is previewed is what is posted.
 */
export async function renderDraftImage(id: string): Promise<{ image: ImageResponse; employer: string } | null> {
  const draft = await prisma.linkedInPostDraft.findUnique({ where: { id }, select: { layout: true, facts: true } })
  if (!draft) return null
  const f = draft.facts as unknown as DraftFacts
  const L = LAYOUTS[draft.layout % LAYOUTS.length]
  const center = L.align === 'center'
  const sub = [f.place, f.effectiveDate ? `effective ${new Date(f.effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}` : null].filter(Boolean).join(' · ')
  const headline = f.percent ? `${f.employees.toLocaleString('en-US')} jobs · ${f.percent}% of staff` : `${f.employees.toLocaleString('en-US')} jobs`
  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, backgroundColor: L.bg, color: L.ink, fontFamily: 'sans-serif', alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left' }}>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, letterSpacing: 2, color: L.accent, textTransform: 'uppercase' }}>{SOURCE_LABEL[f.credibility]}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start' }}>
          <div style={{ display: 'flex', fontSize: 120, fontWeight: 800, lineHeight: 1.05, color: L.accent }}>{headline}</div>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, marginTop: 20 }}>{f.employer}</div>
          {sub ? <div style={{ display: 'flex', fontSize: 34, marginTop: 12, opacity: 0.85 }}>{sub}</div> : null}
        </div>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 600 }}>NextChapter · Support for what comes next</div>
      </div>
    ),
    { width: 1200, height: 627 },
  )
  return { image, employer: f.employer }
}
