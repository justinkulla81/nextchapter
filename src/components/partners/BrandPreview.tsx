import { accentReadableOnWhite, backgroundTokens, contrastRatio, normalizeHex, readableOn } from '@/lib/partners/brand'

// A small sample page in the partner's colors, with plain warnings when a
// combination would be hard to read. Pure display: it never saves anything.
export function BrandPreview({ name, primary, secondary, background, logoUrl }: { name: string; primary: string; secondary: string; background: string; logoUrl?: string | null }) {
  const p = normalizeHex(primary)
  const s = normalizeHex(secondary)
  const b = normalizeHex(background)
  const page = b ? backgroundTokens(b) : null
  const pageBg = page?.['--background'] ?? '#f7f9fa'
  const text = page?.['--foreground'] ?? '#0a0a0a'
  const card = page?.['--card'] ?? '#ffffff'
  const border = page?.['--border'] ?? '#e2e8f0'
  const warnings: string[] = []
  if (p && b && contrastRatio(p, b) < 3) warnings.push('The primary color is close to the background, so links and buttons may be hard to see.')
  else if (p && !b && !accentReadableOnWhite(p)) warnings.push('The primary color is very light against white, so links and charts may be hard to see.')
  if (s && b && contrastRatio(s, b) < 1.3) warnings.push('The secondary color is almost the same as the background, so secondary buttons will blend in.')

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Preview</p>
      <div className="overflow-hidden rounded-lg border border-border" style={{ backgroundColor: pageBg, color: text }}>
        <div className="flex items-center gap-2 bg-navy px-3 py-2 text-sm text-white" style={p ? { boxShadow: `inset 0 -3px 0 ${p}` } : undefined}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-5 max-w-24 object-contain" />
          ) : null}
          <span className="font-medium">{name || 'Your organization'}</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded-md border p-3 text-sm" style={{ backgroundColor: card, borderColor: border }}>
            A card on the page. <span style={{ color: p ?? undefined, textDecoration: 'underline' }}>A link</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: p ?? '#2e7d5b', color: readableOn(p ?? '#2e7d5b') }}>
              Primary action
            </span>
            <span className="rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: s ?? '#e2e8f0', color: readableOn(s ?? '#e2e8f0') }}>
              Secondary
            </span>
          </div>
        </div>
      </div>
      {warnings.map((w) => (
        <p key={w} role="status" className="text-xs text-muted-foreground">
          {w}
        </p>
      ))}
    </div>
  )
}
