// Branding-only white-label (Batch 13/14): a coach's practice name and logo
// on the client-facing tools they use, always co-marked "powered by
// NextChapter" rather than replacing the NextChapter name outright — this
// is a branding layer, not a fully white-labeled separate product.
export function CoachBrandHeader({ firmName, logoUrl }: { firmName: string | null; logoUrl: string | null }) {
  if (!firmName) {
    return <p className="text-sm font-medium text-muted-foreground">NextChapter for Coaches</p>
  }

  return (
    <div className="flex items-center gap-2">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={`${firmName} logo`} className="size-5 rounded-sm object-contain" />
      )}
      <p className="text-sm font-medium text-muted-foreground">
        <span className="text-foreground">{firmName}</span> (powered by NextChapter)
      </p>
    </div>
  )
}
