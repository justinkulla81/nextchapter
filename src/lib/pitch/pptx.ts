import PptxGenJS from 'pptxgenjs'
import type { Deck, DeckSlide } from './types'

// Native, editable shapes and text (no flattened images), so the file opens in
// Google Slides, PowerPoint and Keynote and every word can be changed there.
const W = 13.333
const H = 7.5
const FONT = 'Arial'
const INK = '1F2937'
const MUTED = '6B7280'
const NAVY = '0B2545'

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const hex = (c: string) => c.replace('#', '').toUpperCase()

export async function renderPptx(deck: Deck, opts: { headshot?: string } = {}): Promise<Buffer> {
  const p = new PptxGenJS()
  p.layout = 'LAYOUT_WIDE'
  p.title = deck.title
  p.company = 'NextChapter'
  const P = hex(deck.brand.primary)
  const A = hex(deck.brand.accent)

  const footer = (s: PptxGenJS.Slide, n: number) => {
    s.addShape('line', { x: 0.6, y: 6.95, w: W - 1.2, h: 0, line: { color: 'E5E7EB', width: 0.75 } })
    s.addText('NextChapter', { x: 0.6, y: 7.0, w: 3, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: NAVY })
    s.addText(String(n), { x: W - 1.6, y: 7.0, w: 1, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, align: 'right' })
    if (deck.brand.logo) s.addImage({ data: deck.brand.logo, x: W - 3.3, y: 6.98, h: 0.32, w: 1.5, sizing: { type: 'contain', w: 1.5, h: 0.32 } })
  }
  const head = (s: PptxGenJS.Slide, d: DeckSlide) => {
    if (d.kicker) s.addText(d.kicker.toUpperCase(), { x: 0.6, y: 0.45, w: W - 1.2, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: P, charSpacing: 2 })
    s.addText(d.title, { x: 0.6, y: 0.8, w: W - 1.2, h: 1.0, fontFace: FONT, fontSize: 30, bold: true, color: INK, valign: 'top', fit: 'shrink' })
  }

  deck.slides.forEach((d, idx) => {
    const s = p.addSlide()
    s.background = { color: 'FFFFFF' }
    const n = idx + 1
    if (d.kind === 'cover') {
      s.background = { color: P }
      s.addShape('rect', { x: 0, y: 0, w: 0.35, h: H, fill: { color: A }, line: { color: A } })
      s.addText(d.kicker?.toUpperCase() ?? '', { x: 0.9, y: 1.3, w: W - 1.8, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: 'FFFFFF', charSpacing: 3 })
      s.addText(d.title, { x: 0.9, y: 1.8, w: W - 2.4, h: 2.6, fontFace: FONT, fontSize: 44, bold: true, color: 'FFFFFF', valign: 'top', fit: 'shrink' })
      s.addText('NextChapter', { x: 0.9, y: 5.6, w: 4, h: 0.5, fontFace: FONT, fontSize: 22, bold: true, color: 'FFFFFF' })
      if (deck.brand.logo) {
        s.addShape('roundRect', { x: W - 4.2, y: 5.35, w: 3.4, h: 1.2, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.1 })
        s.addImage({ data: deck.brand.logo, x: W - 4.0, y: 5.45, w: 3.0, h: 1.0, sizing: { type: 'contain', w: 3.0, h: 1.0 } })
      } else if (deck.brand.orgName) {
        s.addText(deck.brand.orgName, { x: W - 5.2, y: 5.6, w: 4.4, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: 'FFFFFF', align: 'right' })
      }
      return
    }
    if (d.kind === 'divider') {
      s.background = { color: NAVY }
      s.addText(d.title, { x: 0.9, y: 2.6, w: W - 1.8, h: 1.6, fontFace: FONT, fontSize: 38, bold: true, color: 'FFFFFF', valign: 'middle' })
      s.addText('The detail behind the numbers in this deck', { x: 0.9, y: 4.2, w: W - 1.8, h: 0.5, fontFace: FONT, fontSize: 16, color: 'D1D5DB' })
      return
    }
    head(s, d)
    footer(s, n)
    const top = 1.95

    switch (d.kind) {
      case 'stats': {
        const f = d.facts ?? []
        const cols = f.length > 4 ? 4 : Math.max(f.length, 1)
        const gap = 0.25
        const cw = (W - 1.2 - gap * (cols - 1)) / cols
        f.forEach((x, k) => {
          const col = k % cols, row = Math.floor(k / cols)
          const cx = 0.6 + col * (cw + gap), cy = top + row * 2.15
          s.addShape('roundRect', { x: cx, y: cy, w: cw, h: 1.95, fill: { color: 'F3F4F6' }, line: { color: 'E5E7EB' }, rectRadius: 0.08 })
          s.addText(x.value, { x: cx + 0.15, y: cy + 0.15, w: cw - 0.3, h: 0.85, fontFace: FONT, fontSize: 34, bold: true, color: P, valign: 'middle', fit: 'shrink' })
          s.addText(x.label, { x: cx + 0.15, y: cy + 1.0, w: cw - 0.3, h: 0.45, fontFace: FONT, fontSize: 12, bold: true, color: INK, valign: 'top', fit: 'shrink' })
          if (x.note) s.addText(x.note, { x: cx + 0.15, y: cy + 1.42, w: cw - 0.3, h: 0.45, fontFace: FONT, fontSize: 10, color: MUTED, valign: 'top', fit: 'shrink' })
        })
        if (d.bullets.length) {
          const rows = Math.ceil(f.length / cols)
          const by = top + rows * 2.15 + 0.1
          s.addText(d.bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: 0.6, y: by, w: W - 1.2, h: 6.7 - by, fontFace: FONT, fontSize: 20, color: INK, valign: 'top', paraSpaceAfter: 10, fit: 'shrink' })
        }
        break
      }
      case 'warn': case 'employers': case 'colleges': case 'datacenters': case 'board': case 'constituents': {
        const header = (d.head ?? []).map((t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: P }, fontFace: FONT, fontSize: 12 } }))
        const body = (d.rows ?? []).map((r) => r.map((t) => ({ text: t, options: { fontFace: FONT, fontSize: 12, color: INK } })))
        if (header.length) s.addTable([header, ...body], { x: 0.6, y: top, w: W - 1.2, border: { type: 'solid', color: 'E5E7EB', pt: 0.75 }, valign: 'middle', rowH: d.kind === 'constituents' ? 0.55 : 0.36, autoPage: false, fontSize: d.kind === 'constituents' ? 11 : 12 })
        if (d.bullets.length) s.addText(d.bullets.join('\n'), { x: 0.6, y: 6.4, w: W - 1.2, h: 0.4, fontFace: FONT, fontSize: 10, italic: true, color: MUTED })
        break
      }
      case 'offer': {
        const o = d.offer
        const colW = (W - 1.2 - 0.5) / 3
        const col = (x: number, title: string, items: string[]) => {
          s.addShape('roundRect', { x, y: top, w: colW, h: 4.5, fill: { color: 'F9FAFB' }, line: { color: 'E5E7EB' }, rectRadius: 0.08 })
          s.addText(title, { x: x + 0.2, y: top + 0.15, w: colW - 0.4, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: P })
          s.addText(items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: x + 0.2, y: top + 0.6, w: colW - 0.4, h: 3.8, fontFace: FONT, fontSize: 14, color: INK, valign: 'top', paraSpaceAfter: 8, fit: 'shrink' })
        }
        col(0.6, 'Every package includes', o?.scope ?? [])
        col(0.6 + colW + 0.25, 'What we need from you', o?.theyProvide ?? [])
        col(0.6 + 2 * (colW + 0.25), 'How we start', [o?.name ?? '', `Length: ${o?.term || 'to be agreed'}`, 'Scope agreed with you on a first call', ...(o?.price?.trim() ? [`Price: ${o.price.trim()}`] : [])].filter(Boolean))
        break
      }
      case 'packages': {
        const pk = d.packages ?? []
        const n = Math.max(pk.length, 1)
        const gap = 0.25
        const cw = (W - 1.2 - gap * (n - 1)) / n
        pk.forEach((x, k) => {
          const cx = 0.6 + k * (cw + gap)
          s.addShape('roundRect', { x: cx, y: top, w: cw, h: 4.6, fill: { color: k === 1 ? 'F3F4F6' : 'FFFFFF' }, line: { color: k === 1 ? P : 'E5E7EB', width: k === 1 ? 2 : 1 }, rectRadius: 0.08 })
          s.addText(x.name, { x: cx + 0.2, y: top + 0.15, w: cw - 0.4, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: P })
          s.addText(x.bestFor, { x: cx + 0.2, y: top + 0.7, w: cw - 0.4, h: 0.7, fontFace: FONT, fontSize: 12, italic: true, color: MUTED, valign: 'top', fit: 'shrink' })
          s.addText(x.includes.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: cx + 0.2, y: top + 1.45, w: cw - 0.4, h: 3.0, fontFace: FONT, fontSize: 13, color: INK, valign: 'top', paraSpaceAfter: 6, fit: 'shrink' })
        })
        break
      }
      case 'demo': {
        const m = d.demo
        if (!m) break
        const fx = 0.6, fy = top - 0.05, fw = W - 1.2, fh = 4.75
        s.addShape('roundRect', { x: fx, y: fy, w: fw, h: fh, fill: { color: 'FFFFFF' }, line: { color: '9CA3AF', width: 1.25 }, rectRadius: 0.1 })
        s.addShape('rect', { x: fx, y: fy, w: fw, h: 0.42, fill: { color: 'F3F4F6' }, line: { color: 'E5E7EB' } })
        ;[0.18, 0.4, 0.62].forEach((dx, k) => s.addShape('ellipse', { x: fx + dx, y: fy + 0.13, w: 0.16, h: 0.16, fill: { color: ['EF4444', 'F59E0B', '10B981'][k] }, line: { color: 'FFFFFF', width: 0 } }))
        s.addText(m.frame, { x: fx + 0.95, y: fy + 0.04, w: fw - 1.2, h: 0.34, fontFace: FONT, fontSize: 12, bold: true, color: NAVY })
        const kn = Math.max(m.kpis.length, 1), kg = 0.2, kw = (fw - 0.4 - kg * (kn - 1)) / kn
        m.kpis.forEach((x, k) => {
          const kx = fx + 0.2 + k * (kw + kg), ky = fy + 0.6
          s.addShape('roundRect', { x: kx, y: ky, w: kw, h: 1.05, fill: { color: 'F3F4F6' }, line: { color: 'E5E7EB' }, rectRadius: 0.06 })
          s.addText(x.value, { x: kx + 0.12, y: ky + 0.06, w: kw - 0.24, h: 0.55, fontFace: FONT, fontSize: 28, bold: true, color: P, valign: 'middle' })
          s.addText(x.label, { x: kx + 0.12, y: ky + 0.62, w: kw - 0.24, h: 0.35, fontFace: FONT, fontSize: 12, color: MUTED, valign: 'top', fit: 'shrink' })
        })
        const header = m.head.map((t) => ({ text: t, options: { bold: true, color: INK, fill: { color: 'E5E7EB' }, fontFace: FONT, fontSize: 13 } }))
        const body = m.rows.map((r) => r.map((t) => ({ text: t, options: { fontFace: FONT, fontSize: 13, color: INK } })))
        if (header.length) s.addTable([header, ...body], { x: fx + 0.2, y: fy + 1.85, w: fw - 0.4, border: { type: 'solid', color: 'E5E7EB', pt: 0.5 }, rowH: 0.5, valign: 'middle', autoPage: false })
        s.addText('Illustrative sample data. Not real people, employers or results.', { x: fx, y: fy + fh + 0.08, w: fw, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: MUTED, align: 'right' })
        break
      }
      case 'timeline': {
        const colW = (W - 1.2 - 0.5) / 3
        d.bullets.slice(0, 3).forEach((b, k) => {
          const x = 0.6 + k * (colW + 0.25)
          const [lead, ...rest] = b.split(': ')
          s.addShape('roundRect', { x, y: top, w: colW, h: 3.2, fill: { color: 'F3F4F6' }, line: { color: 'E5E7EB' }, rectRadius: 0.08 })
          s.addText(rest.length ? lead : `Step ${k + 1}`, { x: x + 0.2, y: top + 0.2, w: colW - 0.4, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: P })
          s.addText(cap(rest.length ? rest.join(': ') : b), { x: x + 0.2, y: top + 0.8, w: colW - 0.4, h: 2.2, fontFace: FONT, fontSize: 16, color: INK, valign: 'top', fit: 'shrink' })
        })
        break
      }
      case 'people': {
        const ppl = d.people ?? []
        const per = Math.min(ppl.length, 3) || 1
        const cw = (W - 1.2 - 0.3 * (per - 1)) / per
        ppl.slice(0, 6).forEach((x, k) => {
          const cx = 0.6 + (k % 3) * (cw + 0.3), cy = top + Math.floor(k / 3) * 2.4
          s.addShape('roundRect', { x: cx, y: cy, w: cw, h: 2.2, fill: { color: 'F9FAFB' }, line: { color: 'E5E7EB' }, rectRadius: 0.08 })
          const hasPhoto = x.name.startsWith('Justin') && opts.headshot
          if (hasPhoto) s.addImage({ data: opts.headshot!, x: cx + 0.2, y: cy + 0.2, w: 0.9, h: 0.9, rounding: true })
          s.addText(x.name, { x: cx + (hasPhoto ? 1.25 : 0.2), y: cy + 0.2, w: cw - (hasPhoto ? 1.4 : 0.4), h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: INK })
          s.addText(`${x.title}, ${x.org}`, { x: cx + (hasPhoto ? 1.25 : 0.2), y: cy + 0.6, w: cw - (hasPhoto ? 1.4 : 0.4), h: 0.5, fontFace: FONT, fontSize: 11, color: MUTED, valign: 'top', fit: 'shrink' })
          if (x.bio) s.addText(x.bio, { x: cx + 0.2, y: cy + 1.2, w: cw - 0.4, h: 0.95, fontFace: FONT, fontSize: 11, color: INK, valign: 'top', fit: 'shrink' })
        })
        break
      }
      default: {
        if (d.constituent && d.bullets.length >= 3) {
          const labels = ['Needs', 'Gets', 'You will see']
          const strip = (b: string) => b.replace(/^(Needs|Gets|You will see):\s*/i, '')
          const cw3 = (W - 1.2 - 0.5) / 3
          d.bullets.slice(0, 3).forEach((b, k) => {
            const cx = 0.6 + k * (cw3 + 0.25)
            s.addShape('roundRect', { x: cx, y: top, w: cw3, h: 4.4, fill: { color: k === 1 ? 'F3F4F6' : 'FFFFFF' }, line: { color: k === 1 ? P : 'E5E7EB', width: k === 1 ? 2 : 1 }, rectRadius: 0.08 })
            s.addText(labels[k].toUpperCase(), { x: cx + 0.25, y: top + 0.2, w: cw3 - 0.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: P, charSpacing: 2 })
            s.addText(cap(strip(b)), { x: cx + 0.25, y: top + 0.75, w: cw3 - 0.5, h: 3.4, fontFace: FONT, fontSize: 20, color: INK, valign: 'top', fit: 'shrink' })
          })
          break
        }
        const bullets = d.bullets
        if (bullets.length) {
          s.addText(bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
            x: 0.6, y: top, w: W - 1.2, h: 4.7, fontFace: FONT, fontSize: bullets.length > 5 ? 20 : 26, color: INK, valign: 'top', paraSpaceAfter: 18, fit: 'shrink',
          })
        }
      }
    }
  })
  const out = await p.write({ outputType: 'nodebuffer' })
  return out as Buffer
}
