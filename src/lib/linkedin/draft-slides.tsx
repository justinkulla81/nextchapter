import 'server-only'
import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import { LAYOUTS, slidesFor, type DraftFacts, type Slide } from './layoff-post-rules'

const W = 1080
const H = 1350

type Palette = (typeof LAYOUTS)[number]

function Frame({ p, index, total, children }: { p: Palette; index: number; total: number; children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 88, backgroundColor: p.bg, color: p.ink, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, fontWeight: 600, opacity: 0.8 }}>
        <div style={{ display: 'flex' }}>NextChapter</div>
        <div style={{ display: 'flex' }}>{index + 1} / {total}</div>
      </div>
    </div>
  )
}

function SlideView({ s, p, index, total }: { s: Slide; p: Palette; index: number; total: number }) {
  const label = (t: string) => <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: p.accent }}>{t}</div>
  if (s.kind === 'cover') {
    return (
      <Frame p={p} index={index} total={total}>
        {label(s.label)}
        <div style={{ display: 'flex', fontSize: 210, fontWeight: 800, lineHeight: 1, color: p.accent, marginTop: 150 }}>{s.big}</div>
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, lineHeight: 1.05, marginTop: 36 }}>{s.name}</div>
        {s.sub ? <div style={{ display: 'flex', fontSize: 40, marginTop: 24, opacity: 0.85 }}>{s.sub}</div> : null}
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, marginTop: 170, color: p.accent }}>Swipe: {s.swipe} →</div>
      </Frame>
    )
  }
  if (s.kind === 'facts') {
    return (
      <Frame p={p} index={index} total={total}>
        {label(s.title)}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 70 }}>
          {s.rows.map((r) => (
            <div key={r.k} style={{ display: 'flex', flexDirection: 'column', marginBottom: 44 }}>
              <div style={{ display: 'flex', fontSize: 30, opacity: 0.7 }}>{r.k}</div>
              <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, lineHeight: 1.15, marginTop: 6 }}>{r.v}</div>
            </div>
          ))}
        </div>
      </Frame>
    )
  }
  if (s.kind === 'step') {
    return (
      <Frame p={p} index={index} total={total}>
        {label(`Step ${s.n} of ${s.total}`)}
        <div style={{ display: 'flex', fontSize: 112, fontWeight: 800, lineHeight: 1.06, marginTop: 190 }}>{s.title}</div>
        <div style={{ display: 'flex', fontSize: 60, lineHeight: 1.28, marginTop: 70, opacity: 0.92 }}>{s.body}</div>
      </Frame>
    )
  }
  if (s.kind === 'market') {
    return (
      <Frame p={p} index={index} total={total}>
        {label(s.title)}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 90 }}>
          {s.stats.map((st) => (
            <div key={st.label} style={{ display: 'flex', flexDirection: 'column', marginBottom: 70 }}>
              <div style={{ display: 'flex', fontSize: 190, fontWeight: 800, lineHeight: 1, color: p.accent }}>{st.value}</div>
              <div style={{ display: 'flex', fontSize: 46, marginTop: 14 }}>{st.label}</div>
            </div>
          ))}
        </div>
      </Frame>
    )
  }
  return (
    <Frame p={p} index={index} total={total}>
      {label('One more thing')}
      <div style={{ display: 'flex', fontSize: 110, fontWeight: 800, lineHeight: 1.05, marginTop: 190 }}>{s.title}</div>
      <div style={{ display: 'flex', fontSize: 60, lineHeight: 1.28, marginTop: 70 }}>{s.body}</div>
      <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, marginTop: 120, color: p.accent }}>{s.brand}</div>
    </Frame>
  )
}

async function load(id: string) {
  const d = await prisma.linkedInPostDraft.findUnique({ where: { id }, select: { layout: true, facts: true, noticeId: true } })
  if (!d) return null
  const facts = d.facts as unknown as DraftFacts
  return { facts, palette: LAYOUTS[d.layout % LAYOUTS.length], slides: slidesFor(facts, d.noticeId) }
}

/** How many slides a draft has. */
export async function slideCount(id: string): Promise<number> {
  return (await load(id))?.slides.length ?? 0
}

/** One slide as an image response (the preview strip and the per-slide download). */
export async function renderDraftSlide(id: string, index: number): Promise<{ image: ImageResponse; employer: string } | null> {
  const d = await load(id)
  if (!d || index < 0 || index >= d.slides.length) return null
  const image = new ImageResponse(<SlideView s={d.slides[index]} p={d.palette} index={index} total={d.slides.length} />, { width: W, height: H })
  return { image, employer: d.facts.employer }
}

/** Every slide as PNG bytes, in order: what gets posted and what goes in the PDF. */
export async function renderDraftSlides(id: string): Promise<{ pngs: Buffer[]; employer: string } | null> {
  const d = await load(id)
  if (!d) return null
  const pngs = await Promise.all(d.slides.map(async (s, i) =>
    Buffer.from(await new ImageResponse(<SlideView s={s} p={d.palette} index={i} total={d.slides.length} />, { width: W, height: H }).arrayBuffer())))
  return { pngs, employer: d.facts.employer }
}
