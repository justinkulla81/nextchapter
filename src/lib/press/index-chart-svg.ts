// The White-Collar Long-Search Index as one self-contained SVG, for anyone to embed as an image. Pure: it takes the published
// series and returns markup, so it is tested without the filesystem. The credit line is part of the picture, so it travels with
// every copy.

export interface IndexSvgPoint {
  /** "YYYY-MM". */
  month: string
  index: number
}

const W = 720
const H = 400
const M = { t: 64, r: 28, b: 84, l: 48 }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthShort = (m: string) => {
  const [y, mm] = m.split('-').map(Number)
  return `${MONTHS[mm - 1]} ${y}`
}
const toYear = (m: string) => {
  const [y, mm] = m.split('-').map(Number)
  return y + (mm - 1) / 12
}

export function indexChartSvg(series: IndexSvgPoint[], opts: { sourceUrl: string; credit: string }): string {
  const pts = series.filter((p) => Number.isFinite(p.index))
  if (pts.length < 2) return ''
  const first = toYear(pts[0].month)
  const last = toYear(pts[pts.length - 1].month)
  const max = Math.max(250, Math.ceil(Math.max(...pts.map((p) => p.index)) / 50) * 50)
  const iw = W - M.l - M.r
  const ih = H - M.t - M.b
  const X = (m: string) => M.l + ((toYear(m) - first) / (last - first)) * iw
  const Y = (v: number) => M.t + (1 - v / max) * ih

  // The series has a gap (October 2025 was not collected): break the line there instead of drawing across it.
  const segments: IndexSvgPoint[][] = []
  let current: IndexSvgPoint[] = []
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && toYear(pts[i].month) - toYear(pts[i - 1].month) > 1.5 / 12) {
      segments.push(current)
      current = []
    }
    current.push(pts[i])
  }
  segments.push(current)
  const paths = segments
    .filter((s) => s.length > 1)
    .map((s) => `M${s.map((p) => `${X(p.month).toFixed(1)} ${Y(p.index).toFixed(1)}`).join('L')}`)
    .join(' ')

  const latest = pts[pts.length - 1]
  const grid = [0, 50, 100, 150, 200, 250].filter((v) => v <= max)
  const years: number[] = []
  for (let y = Math.ceil(first); y <= last; y += 2) years.push(y)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(
    `White-Collar Long-Search Index, ${monthShort(pts[0].month)} to ${monthShort(latest.month)}, 2019 average = 100. ${monthShort(latest.month)}: ${Math.round(latest.index)}.`,
  )}" font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${M.l}" y="28" font-size="18" font-weight="700" fill="#0f2a4a">White-Collar Long-Search Index</text>
<text x="${M.l}" y="46" font-size="12" fill="#4a5568">Long-term unemployment among managers and professionals. 2019 average = 100.</text>
${grid
  .map((v) => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#e2e8f0"/><text x="${M.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#718096">${v}</text>`)
  .join('\n')}
<line x1="${M.l}" x2="${W - M.r}" y1="${Y(100).toFixed(1)}" y2="${Y(100).toFixed(1)}" stroke="#4a5568" stroke-dasharray="4 4"/>
${years.map((y) => `<text x="${(M.l + ((y - first) / (last - first)) * iw).toFixed(1)}" y="${H - M.b + 18}" text-anchor="middle" font-size="11" fill="#718096">${y}</text>`).join('\n')}
<path d="${paths}" fill="none" stroke="#c9711a" stroke-width="2.25" stroke-linejoin="round"/>
<circle cx="${X(latest.month).toFixed(1)}" cy="${Y(latest.index).toFixed(1)}" r="4" fill="#c9711a"/>
<text x="${(X(latest.month) - 8).toFixed(1)}" y="${(Y(latest.index) - 10).toFixed(1)}" text-anchor="end" font-size="13" font-weight="700" fill="#0f2a4a">${monthShort(latest.month)}: ${Math.round(latest.index)}</text>
<text x="${M.l}" y="${H - 42}" font-size="11" fill="#4a5568">Seasonally adjusted, 3-month average. October 2025 was not collected.</text>
<text x="${M.l}" y="${H - 27}" font-size="11" fill="#4a5568">Source: NextChapter calculation from Census Bureau Current Population Survey microdata.</text>
<text x="${M.l}" y="${H - 11}" font-size="11" font-weight="600" fill="#0f2a4a">${esc(opts.credit)} · ${esc(opts.sourceUrl)}</text>
</svg>
`
}
