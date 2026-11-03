import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import { PLACE_IMAGE_FILES, campusImage, settingImage, stateImage } from '@/lib/places/place-image'

describe('place header pictures', () => {
  it('every picture a place can show exists', () => {
    expect(PLACE_IMAGE_FILES.filter((f) => !fs.existsSync(path.join(process.cwd(), 'public', f)))).toEqual([])
  })
  it('every state has a regional scene', () => {
    expect(ALL_STATE_CODES.filter((c) => !stateImage(c))).toEqual([])
  })
  it('picks by size and is stable per place', () => {
    expect(settingImage(2_000_000, 'ny-new-york', 'city')).toMatch(/place-city-[123]/)
    expect(settingImage(120_000, 'oh-akron', 'city')).toMatch(/place-town-[123]/)
    expect(settingImage(null, 'oh-tiny', 'city')).toMatch(/place-rural-[123]/)
    expect(settingImage(120_000, 'oh-akron', 'city')).toBe(settingImage(120_000, 'oh-akron', 'city'))
    expect(PLACE_IMAGE_FILES).toContain(settingImage(80_000, 'x', 'county'))
    expect(PLACE_IMAGE_FILES).toContain(campusImage('ohio-state-university'))
  })
})
