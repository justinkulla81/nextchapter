import { describe, it, expect } from 'vitest'
import { detectNewsKind, instagramPermalink, safeImageUrl, sourceFromUrl, videoEmbedUrl, vimeoId, youtubeId } from '@/lib/news/kind'

describe('youtubeId', () => {
  it('reads every link shape YouTube hands out', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ]) expect(youtubeId(url)).toBe('dQw4w9WgXcQ')
  })
  it('is not fooled by a channel page or another site', () => {
    expect(youtubeId('https://www.youtube.com/@nextchapter')).toBeNull()
    expect(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeId('not a url')).toBeNull()
  })
})

describe('instagramPermalink', () => {
  it('strips tracking and a username prefix down to the embeddable link', () => {
    expect(instagramPermalink('https://www.instagram.com/p/CxYz_12-ab/?utm_source=ig_web_copy_link&igsh=x'))
      .toBe('https://www.instagram.com/p/CxYz_12-ab/')
    expect(instagramPermalink('https://instagram.com/nextchapter/reel/CxYz/')).toBe('https://www.instagram.com/reel/CxYz/')
    expect(instagramPermalink('https://www.instagram.com/reels/CxYz/')).toBe('https://www.instagram.com/reel/CxYz/')
  })
  it('refuses a profile or story, which cannot be embedded', () => {
    expect(instagramPermalink('https://www.instagram.com/nextchapter/')).toBeNull()
    expect(instagramPermalink('https://www.instagram.com/stories/nextchapter/123/')).toBeNull()
  })
})

describe('detectNewsKind', () => {
  it('sorts links into the three kinds', () => {
    expect(detectNewsKind('https://youtu.be/dQw4w9WgXcQ')).toBe('video')
    expect(detectNewsKind('https://vimeo.com/123456789')).toBe('video')
    expect(detectNewsKind('https://www.instagram.com/p/CxYz/')).toBe('instagram')
    expect(detectNewsKind('https://www.inc.com/some/article')).toBe('article')
  })
  it('treats a video on a host we cannot play as an article link', () => {
    expect(detectNewsKind('https://www.linkedin.com/posts/someone_video-123')).toBe('article')
    // An Instagram profile is a link out, not an embed.
    expect(detectNewsKind('https://www.instagram.com/nextchapter/')).toBe('article')
  })
})

describe('videoEmbedUrl', () => {
  it('builds the privacy-friendly player address', () => {
    expect(videoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0')
    expect(vimeoId('https://vimeo.com/channels/staffpicks/123456789')).toBe('123456789')
    expect(videoEmbedUrl('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789?autoplay=1')
    expect(videoEmbedUrl('https://www.inc.com/x')).toBeNull()
  })
})

describe('safeImageUrl', () => {
  it('keeps https, resolves a relative path, and drops everything else', () => {
    expect(safeImageUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(safeImageUrl('/img/a.jpg', 'https://example.com/story')).toBe('https://example.com/img/a.jpg')
    expect(safeImageUrl('http://example.com/a.jpg')).toBeNull()
    expect(safeImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeImageUrl(null)).toBeNull()
  })
})

describe('sourceFromUrl', () => {
  it('names the site without the www', () => {
    expect(sourceFromUrl('https://www.inc.com/a/b')).toBe('inc.com')
  })
})
