// Pure string parsing, no server dependencies — split out from
// youtube-ingest.ts (which is `server-only`) so client components (e.g.
// PodcastCard's inline player) can use it without pulling in that module's
// server-only API-calling code.

// Accepts a bare 11-character video ID, or common YouTube URL shapes
// (watch?v=, youtu.be/, /shorts/).
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.slice(1)
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (url.hostname.includes('youtube.com')) {
      const vParam = url.searchParams.get('v')
      if (vParam && /^[\w-]{11}$/.test(vParam)) return vParam
      const shortsMatch = /\/shorts\/([\w-]{11})/.exec(url.pathname)
      if (shortsMatch) return shortsMatch[1]
    }
  } catch {
    return null
  }
  return null
}
