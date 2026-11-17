import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { pickHero, type Page } from '@/lib/workforce/city-hero'

const page = (title: string, o: { width?: number; height?: number; license?: string; index?: number; artist?: string } = {}): Page & { index?: number } => ({
  title,
  index: o.index,
  imageinfo: [
    {
      thumburl: `https://upload.example/${encodeURIComponent(title)}.jpg`,
      width: o.width ?? 4000,
      height: o.height ?? 2000,
      descriptionurl: `https://commons.example/${encodeURIComponent(title)}`,
      extmetadata: { LicenseShortName: { value: o.license ?? 'CC BY-SA 4.0' }, Artist: { value: o.artist ?? '<a href="x">Jane Photographer</a>' } },
    },
  ],
})

describe('city splash picture', () => {
  it('takes the first good wide photo in search order, with its credit', () => {
    const hit = pickHero([page('File:Skyline B.jpg', { index: 2 }), page('File:Skyline A.jpg', { index: 1 })])
    expect(hit?.sourceUrl).toContain('Skyline%20A')
    expect(hit?.credit).toBe('Photo: Jane Photographer, CC BY-SA 4.0, via Wikimedia Commons')
  })
  it('skips grim titles, tall or small pictures, and licenses that are not free', () => {
    const hit = pickHero([
      page('File:Homeless camp downtown.jpg', { index: 1 }),
      page('File:Tower portrait.jpg', { index: 2, width: 2000, height: 3000 }),
      page('File:Small skyline.jpg', { index: 3, width: 1200, height: 600 }),
      page('File:Skyline fair use.jpg', { index: 4, license: 'Fair use' }),
      page('File:Downtown fire 2021.jpg', { index: 5 }),
      page('File:Riverfront at dusk.jpg', { index: 6 }),
    ])
    expect(hit?.sourceUrl).toContain('Riverfront')
  })
  it('does not reject ordinary words that only contain a blocked one', () => {
    expect(pickHero([page('File:Mapleton plantation lawn.jpg')])?.sourceUrl).toContain('Mapleton')
  })
  it('returns nothing when nothing passes', () => {
    expect(pickHero([page('File:Storm damage.jpg')])).toBeNull()
  })
})
