// No share-to-LinkedIn mechanic existed anywhere in the app (checked the
// Prompt 51 badge system — no share code at all). This is the first one,
// built as a shared, reusable primitive rather than a one-off for the
// employer confirmation screen, so the badge system can adopt the same
// component later instead of a second one being built then. LinkedIn's
// share-offsite endpoint needs no API key or auth — it's a plain link.
export function ShareToLinkedIn({ url, className }: { url: string; className?: string }) {
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  return (
    <a
      href={shareUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        'inline-flex items-center gap-2 rounded-md bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a66c2]/90'
      }
    >
      Share on LinkedIn
    </a>
  )
}
