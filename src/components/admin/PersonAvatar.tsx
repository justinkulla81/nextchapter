/**
 * A small round profile photo for list rows. Without one, a blank face
 * outline holds the same space so names stay aligned down the column.
 */
export function PersonAvatar({ url, name, size = 32 }: { url: string | null | undefined; name: string; size?: number }) {
  const box = { width: size, height: size }
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={`Photo of ${name}`} style={box} loading="lazy" className="shrink-0 rounded-full border border-border object-cover" />
    )
  }
  return (
    <span style={box} role="img" aria-label={`No photo of ${name}`} className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground/60">
      <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="9" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </svg>
    </span>
  )
}
