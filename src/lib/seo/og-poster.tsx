import { ImageResponse } from 'next/og'

export const POSTER_SIZE = { width: 1200, height: 630 }

/**
 * Share cards that are not all the same card. Each card picks a color palette and a layout from the page it describes (its slug or
 * state), so a layoff at one employer and a layoff at another look different, and the same page always looks the same. Each shows one
 * real number, large, with what it counts and whose it is. Layouts: a giant number, a split panel, a field of dots (one per group of
 * people, for a layoff) and a bar ladder (for a ranking). Text meets AA contrast against its background in every palette.
 */

export interface Palette { bg: string; ink: string; accent: string; soft: string }

export const PALETTES: Palette[] = [
  { bg: '#0B1F33', ink: '#FFFFFF', accent: '#FFC233', soft: '#1D3A57' }, // ink and amber
  { bg: '#0E4F4A', ink: '#FFFFFF', accent: '#FF8A66', soft: '#176A63' }, // teal and coral
  { bg: '#35124A', ink: '#FFFFFF', accent: '#C6F432', soft: '#4C1E66' }, // plum and lime
  { bg: '#FFF1D6', ink: '#14213D', accent: '#2145E6', soft: '#F3DDAF' }, // cream and cobalt
  { bg: '#1E3FD9', ink: '#FFFFFF', accent: '#FFE14D', soft: '#3A58E6' }, // cobalt and sun
  { bg: '#1A1A1A', ink: '#FFFFFF', accent: '#FF6B2C', soft: '#2E2E2E' }, // charcoal and orange
  { bg: '#12372A', ink: '#F6FFF2', accent: '#FFB58A', soft: '#1E4D3B' }, // forest and peach
  { bg: '#FFE0E6', ink: '#2B0A3D', accent: '#C2185B', soft: '#F9C2CF' }, // rose and berry
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export type PosterLayout = 'giant' | 'split' | 'dots' | 'bars'

export interface PosterOptions {
  /** What the card is about (a slug or a state), so the same page always gets the same card and different pages differ. */
  seed: string
  /** A short label above the number: "Layoff tracker", "Ranking", "Unemployment benefits". */
  kicker: string
  /** The one number, already formatted: "1,800", "$370", "#1". */
  big: string
  /** What the number counts: "jobs cut", "a week", "of 100 cities". */
  unit: string
  /** Whose it is: the employer, the state, the list. */
  title: string
  detail?: string
  /** Shown when a layout can use it: how many people (dots), or the ranked rows (bars). */
  people?: number
  bars?: { label: string; valueLabel: string; frac: number }[]
}

/** Which layout a card uses: from the seed, among those its data supports. Exported so it can be tested. */
export function pickLayout(o: Pick<PosterOptions, 'seed' | 'people' | 'bars'>): PosterLayout {
  const options: PosterLayout[] = ['giant', 'split']
  if (o.people && o.people >= 20) options.push('dots', 'dots')
  if (o.bars && o.bars.length >= 3) options.push('bars', 'bars', 'bars')
  return options[hash(`${o.seed}:layout`) % options.length]
}

export const pickPalette = (seed: string): Palette => PALETTES[hash(`${seed}:palette`) % PALETTES.length]

const bigSize = (s: string, base: number) => (s.length <= 3 ? base * 1.15 : s.length <= 5 ? base : s.length <= 7 ? base * 0.8 : base * 0.62)
const titleSize = (s: string) => (s.length > 46 ? 44 : s.length > 30 ? 54 : 66)

function Pill({ p, text }: { p: Palette; text: string }) {
  return <div style={{ display: 'flex', background: p.accent, color: p.bg, fontSize: 28, fontWeight: 700, padding: '8px 22px', borderRadius: 999 }}>{text}</div>
}

function Brand({ p }: { p: Palette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, fontWeight: 700, color: p.ink }}>
      <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 999, background: p.accent, marginRight: 12 }} />
      NextChapter
    </div>
  )
}

export function ogPoster(o: PosterOptions): ImageResponse {
  const p = pickPalette(o.seed)
  const layout = pickLayout(o)
  const frame = { display: 'flex', width: '100%', height: '100%', background: p.bg, color: p.ink, position: 'relative' as const }

  if (layout === 'split') {
    return new ImageResponse(
      (
        <div style={frame}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 560, background: p.accent, color: p.bg, padding: '0 40px' }}>
            <div style={{ display: 'flex', fontSize: bigSize(o.big, 210), fontWeight: 800, lineHeight: 0.95, letterSpacing: -6 }}>{o.big}</div>
            <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, marginTop: 14 }}>{o.unit}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '52px 56px' }}>
            <Pill p={p} text={o.kicker} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: titleSize(o.title), fontWeight: 800, lineHeight: 1.05 }}>{o.title}</div>
              {o.detail ? <div style={{ display: 'flex', fontSize: 30, marginTop: 18, opacity: 0.85 }}>{o.detail}</div> : null}
            </div>
            <Brand p={p} />
          </div>
        </div>
      ),
      POSTER_SIZE,
    )
  }

  if (layout === 'dots' && o.people) {
    const per = Math.max(1, Math.ceil(o.people / 150))
    const count = Math.min(150, Math.max(1, Math.round(o.people / per)))
    return new ImageResponse(
      (
        <div style={{ ...frame, flexDirection: 'column', padding: '44px 56px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pill p={p} text={o.kicker} />
            <Brand p={p} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', width: 1088, height: 270, alignContent: 'flex-start' }}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} style={{ display: 'flex', width: 30, height: 30, borderRadius: 999, margin: 6, background: p.accent }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: titleSize(o.title), fontWeight: 800, lineHeight: 1.05, maxWidth: 700 }}>{o.title}</div>
              <div style={{ display: 'flex', fontSize: 26, marginTop: 10, opacity: 0.85 }}>{per > 1 ? `Each dot is ${per.toLocaleString('en-US')} jobs` : 'Each dot is one job'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <div style={{ display: 'flex', fontSize: bigSize(o.big, 150), fontWeight: 800, color: p.accent, letterSpacing: -4, lineHeight: 0.9 }}>{o.big}</div>
              <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, marginLeft: 16 }}>{o.unit}</div>
            </div>
          </div>
        </div>
      ),
      POSTER_SIZE,
    )
  }

  if (layout === 'bars' && o.bars) {
    const rows = o.bars.slice(0, 5)
    return new ImageResponse(
      (
        <div style={{ ...frame, flexDirection: 'column', padding: '44px 56px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pill p={p} text={o.kicker} />
            <Brand p={p} />
          </div>
          <div style={{ display: 'flex', fontSize: titleSize(o.title), fontWeight: 800, lineHeight: 1.05 }}>{o.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, i) => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', marginTop: i ? 12 : 0 }}>
                <div style={{ display: 'flex', width: 300, fontSize: 28, fontWeight: i === 0 ? 800 : 600 }}>{r.label}</div>
                <div style={{ display: 'flex', width: Math.max(40, Math.round(r.frac * 560)), height: 40, borderRadius: 8, background: i === 0 ? p.accent : p.soft, border: i === 0 ? 'none' : `2px solid ${p.accent}` }} />
                <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, marginLeft: 16, color: i === 0 ? p.accent : p.ink }}>{r.valueLabel}</div>
              </div>
            ))}
          </div>
        </div>
      ),
      POSTER_SIZE,
    )
  }

  // giant number
  return new ImageResponse(
    (
      <div style={{ ...frame, flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px' }}>
        <div style={{ display: 'flex', position: 'absolute', right: -140, top: -160, width: 560, height: 560, borderRadius: 999, background: p.soft }} />
        <div style={{ display: 'flex', position: 'absolute', right: 120, bottom: -90, width: 200, height: 200, borderRadius: 999, background: p.accent, opacity: 0.25 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pill p={p} text={o.kicker} />
          <Brand p={p} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          <div style={{ display: 'flex', fontSize: bigSize(o.big, 250), fontWeight: 800, color: p.accent, lineHeight: 0.88, letterSpacing: -8 }}>{o.big}</div>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, marginTop: 10 }}>{o.unit}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: titleSize(o.title), fontWeight: 800, lineHeight: 1.05 }}>{o.title}</div>
          {o.detail ? <div style={{ display: 'flex', fontSize: 28, marginTop: 10, opacity: 0.85 }}>{o.detail}</div> : null}
        </div>
      </div>
    ),
    POSTER_SIZE,
  )
}
