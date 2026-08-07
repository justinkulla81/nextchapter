import type { VideoProvider } from '@prisma/client'

function youtubeEmbedUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  }
  return null
}

// NC-hosted and YouTube always render inline. Everything else (Instagram,
// TikTok, etc.) renders as a link-out card by default — no third-party
// embed script is ever loaded — unless the admin has explicitly set
// useInlineEmbed for that entry (e.g. they pasted a URL that's itself
// already an embeddable iframe src, like an Instagram post's /embed URL).
export function VideoEmbed({
  provider,
  url,
  useInlineEmbed,
}: {
  provider: VideoProvider
  url: string
  useInlineEmbed: boolean
}) {
  if (provider === 'NC_HOSTED') {
    return (
      <video controls preload="metadata" className="w-full rounded-md" src={url}>
        Your browser doesn&apos;t support embedded video.
      </video>
    )
  }

  if (provider === 'YOUTUBE') {
    const embedUrl = youtubeEmbedUrl(url)
    if (embedUrl) {
      return (
        <div className="aspect-video w-full overflow-hidden rounded-md">
          <iframe
            src={embedUrl}
            className="h-full w-full"
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )
    }
    // Malformed URL we couldn't parse a video ID from — fall through to the
    // link-out card rather than rendering a broken iframe.
  }

  if (useInlineEmbed) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-md">
        <iframe src={url} className="h-full w-full" title="Video" allowFullScreen />
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
    >
      <span aria-hidden>▶</span> Watch this video <span aria-hidden>↗</span>
    </a>
  )
}
